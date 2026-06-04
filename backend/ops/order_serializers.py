"""Serializers for the orders slice.

Read serializers (:class:`OrderSerializer` and its nested line/modifier
serializers) expose the **server-computed** money fields read-only.
:class:`PlaceOrderSerializer` is the write boundary: it accepts ONLY item/qty/
modifier references plus optional seat/note — never a ``price`` or ``total``.
Anything a client sends outside the declared fields is dropped by DRF before it
ever reaches :func:`ops.services.place_order`.
"""
from __future__ import annotations

from rest_framework import serializers

from ops.models import ORDER_STATUS_CHOICES, Order, OrderLine, OrderLineModifier

_ORDER_STATUS_VALUES = [value for value, _label in ORDER_STATUS_CHOICES]


class OrderLineModifierSerializer(serializers.ModelSerializer):
    """Read-only snapshot of a selected modifier on an order line."""

    class Meta:
        model = OrderLineModifier
        fields = ["id", "modifier", "label", "price_delta_minor"]
        read_only_fields = fields


class OrderLineSerializer(serializers.ModelSerializer):
    """Read-only snapshot of a sold line, with its modifiers nested."""

    modifiers = OrderLineModifierSerializer(many=True, read_only=True)

    class Meta:
        model = OrderLine
        fields = [
            "id",
            "menu_item",
            "item_name",
            "unit_price_minor",
            "qty",
            "category_id",
            "seat",
            "note",
            "modifiers",
        ]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    """Read serializer for an order with nested lines and all money fields."""

    lines = OrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "code",
            "table",
            "waiter_membership",
            "customer_id",
            "source",
            "status",
            "confirmation",
            "subtotal_minor",
            "discount_pct",
            "tax_minor",
            "total_minor",
            "paid",
            "voided",
            "comp",
            "placed_at",
            "version",
            "lines",
        ]
        read_only_fields = fields


class PlaceOrderLineSerializer(serializers.Serializer):
    """A single requested line: references only — pricing is server-derived."""

    menu_item_id = serializers.UUIDField()
    qty = serializers.IntegerField(min_value=1)
    modifier_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    seat = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    note = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )


class PlaceOrderSerializer(serializers.Serializer):
    """Write boundary for placing an order.

    Deliberately declares NO ``price``/``total`` field: the server computes all
    money from the menu. ``table_id`` / ``waiter_membership_id`` are optional;
    ``source`` defaults to ``staff``; ``lines`` must be non-empty.
    """

    table_id = serializers.UUIDField(required=False, allow_null=True)
    waiter_membership_id = serializers.UUIDField(required=False, allow_null=True)
    source = serializers.ChoiceField(
        choices=["guest", "staff"], required=False, default="staff"
    )
    lines = PlaceOrderLineSerializer(many=True)

    def validate_lines(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("At least one line is required.")
        return value


# ── Governance / status request boundaries (validate + document) ────────────
class OrderStatusSerializer(serializers.Serializer):
    """PATCH body for an order status transition with optimistic concurrency."""

    status = serializers.ChoiceField(choices=_ORDER_STATUS_VALUES)
    version = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class OrderVoidSerializer(serializers.Serializer):
    """Void request: an optional human-readable reason for the audit log."""

    reason = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class OrderCompSerializer(serializers.Serializer):
    """Comp request: an optional reason for the audit log."""

    reason = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class OrderDiscountSerializer(serializers.Serializer):
    """Discount request: a 0–100 percentage plus an optional reason."""

    discount_pct = serializers.IntegerField(min_value=0, max_value=100)
    reason = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
