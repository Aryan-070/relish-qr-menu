"""DRF viewsets for the menu console CRUD surface.

Every viewset is tenant-scoped end to end:

* **Reads** go through ``Model.objects`` (the ``TenantManager``), which
  auto-filters to the active restaurant and always excludes soft-deleted rows.
  ``get_queryset`` additionally pins ``restaurant_id`` belt-and-suspenders.
* **Writes** stamp ``restaurant_id = get_current_restaurant_id()`` on create so
  the client never supplies (or spoofs) the tenant.
* **Deletes** are soft (``instance.soft_delete()``), never hard.

Authorization: safe methods need an authenticated tenant member; unsafe methods
additionally require the ``edit-menu`` permission (enforced per-action via
``get_permissions``).

``MenuItemViewSet`` adds optimistic concurrency: an update carrying a ``version``
that no longer matches the stored row is rejected with HTTP 409; a successful
update bumps ``version`` by one.
"""
from __future__ import annotations

from typing import Any

from rest_framework import status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.context import get_current_restaurant_id
from common.permissions import HasPermission, IsTenantMember
from menu.models import (
    MenuCategory,
    MenuItem,
    Modifier,
    ModifierGroup,
)
from menu.serializers import (
    MenuCategorySerializer,
    MenuItemSerializer,
    ModifierGroupSerializer,
    ModifierSerializer,
)

#: Permission key gating every write to the menu console.
EDIT_MENU_PERMISSION = "edit-menu"

#: Actions that mutate state and therefore require ``edit-menu``.
_WRITE_ACTIONS = frozenset({"create", "update", "partial_update", "destroy"})


class StaleVersionError(APIException):
    """Raised when an update carries a stale optimistic-concurrency token."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This item was modified by someone else. Reload and try again."
    )
    default_code = "stale_version"


class TenantScopedMenuViewSet(viewsets.ModelViewSet):
    """Shared base: tenant-scoped reads, stamped writes, soft deletes.

    Subclasses set ``model``, ``queryset`` and ``serializer_class``. Reads are
    scoped by the model's ``TenantManager`` plus an explicit ``restaurant_id``
    filter; create stamps the active tenant; destroy soft-deletes.
    """

    model: type[Any]

    def get_permissions(self) -> list[Any]:
        """Read = authenticated tenant member; write = also ``edit-menu``."""
        permissions: list[Any] = [IsAuthenticated(), IsTenantMember()]
        if self.action in _WRITE_ACTIONS:
            permissions.append(HasPermission(EDIT_MENU_PERMISSION)())
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


class MenuCategoryViewSet(TenantScopedMenuViewSet):
    model = MenuCategory
    queryset = MenuCategory.objects.all()
    serializer_class = MenuCategorySerializer


class MenuItemViewSet(TenantScopedMenuViewSet):
    model = MenuItem
    queryset = MenuItem.objects.select_related("category").all()
    serializer_class = MenuItemSerializer

    def update(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Update with optimistic concurrency.

        If the request body includes ``version`` and it does not match the
        stored row's ``version``, reject with HTTP 409. On success, bump the
        stored ``version`` by one.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        client_version = self._client_version(request.data)
        if client_version is not None and client_version != instance.version:
            raise StaleVersionError()

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        # ``version`` is read-only on the serializer, so bump it explicitly.
        serializer.save(version=instance.version + 1)

        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    @staticmethod
    def _client_version(data: Any) -> int | None:
        """Coerce a supplied ``version`` to ``int``; ``None`` when absent/blank."""
        raw = data.get("version") if hasattr(data, "get") else None
        if raw in (None, ""):
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None


class ModifierGroupViewSet(TenantScopedMenuViewSet):
    model = ModifierGroup
    queryset = ModifierGroup.objects.prefetch_related("modifiers").all()
    serializer_class = ModifierGroupSerializer


class ModifierViewSet(TenantScopedMenuViewSet):
    model = Modifier
    queryset = Modifier.objects.select_related("group").all()
    serializer_class = ModifierSerializer
