"""DRF viewsets for the inventory & procurement console.

Every viewset is tenant-scoped end to end:

* **Reads** go through ``Model.objects`` (the ``TenantManager``), which
  auto-filters to the active restaurant and excludes soft-deleted rows;
  ``get_queryset`` additionally pins ``restaurant_id`` belt-and-suspenders.
* **Writes** stamp ``restaurant_id = get_current_restaurant_id()`` on create.
* **Deletes** are soft (``instance.soft_delete()``) on tenant-scoped models.

Authorization: safe methods need an authenticated tenant member; unsafe
methods — create / update / delete plus the custom ``receive`` / ``adjust`` /
wastage-create actions — additionally require the ``manage-stock`` permission
(enforced per-action via ``get_permissions``).

Stock balances are NEVER mutated here directly: the ``receive``, ``adjust`` and
wastage-create actions delegate to :mod:`inventory.services`, the only writer of
the ``StockMovement`` ledger.
"""
from __future__ import annotations

from typing import Any

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.context import get_current_restaurant_id
from common.permissions import HasPermission, IsTenantMember
from inventory.models import (
    Ingredient,
    Promo,
    PurchaseOrder,
    Recipe,
    StockMovement,
    Supplier,
    Wastage,
)
from inventory.serializers import (
    AdjustStockSerializer,
    CreatePurchaseOrderSerializer,
    IngredientSerializer,
    PromoSerializer,
    PurchaseOrderSerializer,
    RecipeSerializer,
    StockMovementSerializer,
    SupplierSerializer,
    WastageSerializer,
)
from inventory.services import (
    InventoryError,
    adjust_stock,
    receive_purchase_order,
    record_wastage,
)

#: Permission key gating every write/stock-moving action in this app.
MANAGE_STOCK_PERMISSION = "manage-stock"

#: Built-in actions that mutate state and therefore require ``manage-stock``.
_WRITE_ACTIONS = frozenset(
    {"create", "update", "partial_update", "destroy"}
)
#: Custom stock-moving actions that also require ``manage-stock``.
_WRITE_EXTRA_ACTIONS = frozenset({"receive", "adjust"})


class _TenantScopedViewSet(viewsets.ModelViewSet):
    """Shared base: tenant-scoped reads, stamped writes, soft deletes.

    Subclasses set ``model``, ``queryset`` and ``serializer_class``. Reads are
    scoped by the model's ``TenantManager`` plus an explicit ``restaurant_id``
    filter; create stamps the active tenant; destroy soft-deletes.
    """

    model: type[Any]

    def get_permissions(self) -> list[Any]:
        """Read = authenticated tenant member; write = also ``manage-stock``."""
        permissions: list[Any] = [IsAuthenticated(), IsTenantMember()]
        if self.action in _WRITE_ACTIONS or self.action in _WRITE_EXTRA_ACTIONS:
            permissions.append(HasPermission(MANAGE_STOCK_PERMISSION)())
        return permissions

    def get_queryset(self):
        """Active-tenant rows only (manager excludes soft-deleted)."""
        return self.model.objects.filter(
            restaurant_id=get_current_restaurant_id()
        )

    def perform_create(self, serializer) -> None:
        """Stamp the active restaurant onto the new row."""
        serializer.save(restaurant_id=get_current_restaurant_id())

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()


class SupplierViewSet(_TenantScopedViewSet):
    model = Supplier
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class IngredientViewSet(_TenantScopedViewSet):
    model = Ingredient
    queryset = Ingredient.objects.select_related("supplier").all()
    serializer_class = IngredientSerializer

    @action(detail=False, methods=["get"])
    def low_stock(self, request: Any) -> Response:
        """List ingredients whose stock is strictly below their threshold."""
        from django.db.models import F

        queryset = self.get_queryset().filter(stock__lt=F("low_threshold"))
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def adjust(self, request: Any, pk: str | None = None) -> Response:
        """Apply a signed manual stock adjustment through the ledger."""
        ingredient = self.get_object()
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adjust_stock(
            ingredient=ingredient,
            delta=serializer.validated_data["delta"],
            reason="adjust",
        )
        return Response(
            IngredientSerializer(ingredient).data, status=status.HTTP_200_OK
        )


class RecipeViewSet(_TenantScopedViewSet):
    model = Recipe
    queryset = Recipe.objects.select_related("menu_item").prefetch_related(
        "lines"
    ).all()
    serializer_class = RecipeSerializer

    def perform_create(self, serializer) -> None:
        """The serializer's ``create`` stamps lines; stamp the recipe here."""
        serializer.save(restaurant_id=get_current_restaurant_id())


class PurchaseOrderViewSet(_TenantScopedViewSet):
    model = PurchaseOrder
    queryset = PurchaseOrder.objects.select_related("supplier").prefetch_related(
        "lines"
    ).all()
    serializer_class = PurchaseOrderSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return CreatePurchaseOrderSerializer
        return PurchaseOrderSerializer

    def perform_create(self, serializer) -> None:
        """The create serializer stamps the PO + lines and generates the code."""
        serializer.save()

    @action(detail=True, methods=["post"])
    def receive(self, request: Any, pk: str | None = None) -> Response:
        """Receive the PO: post ``+qty`` purchase movements for every line."""
        po = self.get_object()
        try:
            receive_purchase_order(po)
        except InventoryError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(
            PurchaseOrderSerializer(po).data, status=status.HTTP_200_OK
        )


class WastageViewSet(_TenantScopedViewSet):
    model = Wastage
    queryset = Wastage.objects.select_related("ingredient").all()
    serializer_class = WastageSerializer

    def create(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Record wastage through the service so stock is depleted via ledger."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wastage = record_wastage(
            ingredient=serializer.validated_data["ingredient"],
            qty=serializer.validated_data["qty"],
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(
            WastageSerializer(wastage).data, status=status.HTTP_201_CREATED
        )


class PromoViewSet(_TenantScopedViewSet):
    model = Promo
    queryset = Promo.objects.all()
    serializer_class = PromoSerializer


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ledger feed, tenant-scoped, newest first."""

    queryset = StockMovement.objects.select_related("ingredient").all()
    serializer_class = StockMovementSerializer

    def get_permissions(self) -> list[Any]:
        return [IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        return StockMovement.objects.filter(
            restaurant_id=get_current_restaurant_id()
        )
