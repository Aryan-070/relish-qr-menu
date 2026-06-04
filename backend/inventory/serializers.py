"""Serializers for the inventory & procurement console.

Tenancy is enforced in the views (the active ``restaurant_id`` is stamped on
create), so these serializers never accept or expose it as a writable field.
Nested writes (recipe lines, purchase-order lines) are handled by their parent
serializer's ``create`` so the plain line rows are stamped with the tenant too.

Money is integer minor units; quantities are :class:`~decimal.Decimal`.
"""
from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from common.context import get_current_restaurant_id
from inventory.models import (
    Ingredient,
    Promo,
    PurchaseOrder,
    PurchaseOrderLine,
    Recipe,
    RecipeLine,
    StockMovement,
    Supplier,
    Wastage,
)


class SupplierSerializer(serializers.ModelSerializer):
    """A supplier belonging to the active restaurant."""

    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "email"]
        read_only_fields = ["id"]


class IngredientSerializer(serializers.ModelSerializer):
    """An ingredient with its running stock balance and low-stock flag.

    ``is_low`` is read-only and ``True`` when ``stock < low_threshold``.
    """

    is_low = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = [
            "id",
            "name",
            "unit",
            "stock",
            "low_threshold",
            "cost_per_unit_minor",
            "supplier",
            "is_low",
        ]
        read_only_fields = ["id", "is_low"]

    def get_is_low(self, obj: Ingredient) -> bool:
        return obj.stock < obj.low_threshold


class RecipeLineSerializer(serializers.ModelSerializer):
    """A single bill-of-materials line (ingredient + quantity)."""

    class Meta:
        model = RecipeLine
        fields = ["id", "ingredient", "qty"]
        read_only_fields = ["id"]


class RecipeSerializer(serializers.ModelSerializer):
    """A recipe (BOM for a menu item) with its lines.

    ``lines`` is writable on create: pass a list of ``{ingredient, qty}`` and
    each line row is created and stamped with the active tenant.
    """

    lines = RecipeLineSerializer(many=True, required=False)

    class Meta:
        model = Recipe
        fields = ["id", "menu_item", "lines"]
        read_only_fields = ["id"]

    def create(self, validated_data: dict) -> Recipe:
        lines_data = validated_data.pop("lines", [])
        restaurant_id = get_current_restaurant_id()
        recipe = Recipe.objects.create(**validated_data)
        for line in lines_data:
            RecipeLine.objects.create(
                restaurant_id=restaurant_id, recipe=recipe, **line
            )
        return recipe

    def update(self, instance: Recipe, validated_data: dict) -> Recipe:
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            restaurant_id = get_current_restaurant_id()
            instance.lines.all().delete()
            for line in lines_data:
                RecipeLine.objects.create(
                    restaurant_id=restaurant_id, recipe=instance, **line
                )
        return instance


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    """A single purchase-order line (ingredient, quantity, line cost)."""

    class Meta:
        model = PurchaseOrderLine
        fields = ["id", "ingredient", "qty", "cost_minor"]
        read_only_fields = ["id"]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """A purchase order with its lines (read representation)."""

    lines = PurchaseOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "code",
            "supplier",
            "status",
            "received_at",
            "lines",
        ]
        read_only_fields = ["id", "code", "status", "received_at", "lines"]


class _CreatePurchaseOrderLineSerializer(serializers.Serializer):
    """Input shape for a single line in :class:`CreatePurchaseOrderSerializer`."""

    ingredient_id = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.all(), source="ingredient"
    )
    qty = serializers.DecimalField(max_digits=12, decimal_places=3)
    cost_minor = serializers.IntegerField(default=0)


class CreatePurchaseOrderSerializer(serializers.Serializer):
    """Create a purchase order with nested lines.

    Accepts ``supplier`` + ``lines`` (each ``{ingredient_id, qty,
    cost_minor}``). The code is generated server-side and the PO + its lines
    are stamped with the active tenant by the view's ``perform_create``.
    """

    supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.all())
    lines = _CreatePurchaseOrderLineSerializer(many=True)

    def validate_lines(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("At least one line is required.")
        return value

    def create(self, validated_data: dict) -> PurchaseOrder:
        from inventory.services import next_po_code

        lines_data = validated_data.pop("lines")
        restaurant_id = get_current_restaurant_id()
        po = PurchaseOrder.objects.create(
            restaurant_id=restaurant_id,
            code=next_po_code(restaurant_id),
            supplier=validated_data["supplier"],
            status="ordered",
        )
        for line in lines_data:
            PurchaseOrderLine.objects.create(
                restaurant_id=restaurant_id,
                purchase_order=po,
                ingredient=line["ingredient"],
                qty=line["qty"],
                cost_minor=line.get("cost_minor", 0),
            )
        return po

    def to_representation(self, instance: PurchaseOrder) -> dict:
        return PurchaseOrderSerializer(instance, context=self.context).data


class WastageSerializer(serializers.ModelSerializer):
    """A wastage event; creating one deplete stock through the ledger."""

    class Meta:
        model = Wastage
        fields = ["id", "ingredient", "qty", "reason"]
        read_only_fields = ["id"]


class StockMovementSerializer(serializers.ModelSerializer):
    """A read-only ledger entry: signed delta + reason + optional ref."""

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "ingredient",
            "delta",
            "reason",
            "ref_id",
            "created_at",
        ]
        read_only_fields = fields


class AdjustStockSerializer(serializers.Serializer):
    """Input for the ingredient ``adjust/`` action (signed manual delta)."""

    delta = serializers.DecimalField(max_digits=12, decimal_places=3)
    reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_delta(self, value: Decimal) -> Decimal:
        if value == 0:
            raise serializers.ValidationError("Delta must be non-zero.")
        return value


class PromoSerializer(serializers.ModelSerializer):
    """A promotion / discount rule belonging to the active restaurant."""

    class Meta:
        model = Promo
        fields = [
            "id",
            "code",
            "name",
            "kind",
            "value",
            "single_use",
            "active",
            "start_hour",
            "end_hour",
        ]
        read_only_fields = ["id"]
