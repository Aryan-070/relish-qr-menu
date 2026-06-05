"""Serializers for the dining-session API.

The session snapshot is the polling payload guest devices read; it exposes
status, ordering policy, presence, the live orders, and the check totals — all
server-computed, read-only. Write boundaries (join / submit / promote / etc.)
accept references only, never money.
"""
from __future__ import annotations

from rest_framework import serializers

from ops.order_serializers import OrderSerializer

from .constants import ORDER_CONFIRMATION_MODE_CHOICES, SERVICE_REQUEST_TYPE_CHOICES
from .models import Check, DiningSession, GuestDevice, ServiceRequest

_MODE_VALUES = [value for value, _label in ORDER_CONFIRMATION_MODE_CHOICES]


class GuestDeviceSerializer(serializers.ModelSerializer):
    """Presence view of a device — never leaks the secret ``device_token``."""

    class Meta:
        model = GuestDevice
        fields = ["id", "display_name", "role", "is_payer", "last_seen"]
        read_only_fields = fields


class CheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Check
        fields = [
            "id",
            "subtotal_minor",
            "tax_minor",
            "service_charge_minor",
            "total_minor",
            "paid_minor",
            "status",
            "liable_customer",
        ]
        read_only_fields = fields


class DiningSessionSerializer(serializers.ModelSerializer):
    """Full session snapshot (the GET / polling payload)."""

    devices = GuestDeviceSerializer(many=True, read_only=True)
    check = CheckSerializer(source="tab", read_only=True)
    orders = serializers.SerializerMethodField()
    # The requesting device's own view of itself (null for staff/no-token), plus
    # the server-authoritative "may I order?" flag so the UI never has to guess.
    me = serializers.SerializerMethodField()
    can_order = serializers.SerializerMethodField()
    table_code = serializers.CharField(source="table.code", read_only=True)
    table_label = serializers.CharField(source="table.label", read_only=True)

    class Meta:
        model = DiningSession
        fields = [
            "id",
            "table",
            "table_code",
            "table_label",
            "status",
            "epoch",
            "order_confirmation_mode",
            "leader_device",
            "party_size",
            "opened_at",
            "closed_at",
            "version",
            "devices",
            "check",
            "orders",
            "me",
            "can_order",
        ]
        read_only_fields = fields

    def get_orders(self, obj: DiningSession) -> list:
        orders = obj.orders.filter(voided=False).prefetch_related("lines__modifiers")
        return OrderSerializer(orders, many=True).data

    def get_me(self, obj: DiningSession) -> dict | None:
        device = self.context.get("device")
        if device is None:
            return None
        return {
            "id": str(device.id),
            "role": device.role,
            "is_payer": device.is_payer,
        }

    def get_can_order(self, obj: DiningSession) -> bool:
        from .services import device_can_order

        return device_can_order(obj, self.context.get("device"))


# ── Write boundaries ──────────────────────────────────────────────────────────
class JoinSessionSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    table_id = serializers.UUIDField()
    display_name = serializers.CharField(
        max_length=80, required=False, allow_blank=True, default=""
    )


class JoinResultSerializer(serializers.Serializer):
    """What a freshly-joined device gets back (includes its secret token once)."""

    session_id = serializers.UUIDField()
    device_token = serializers.UUIDField()
    role = serializers.CharField()
    epoch = serializers.IntegerField()
    order_confirmation_mode = serializers.ChoiceField(choices=_MODE_VALUES)
    status = serializers.CharField()


class PromoteSerializer(serializers.Serializer):
    # Staff promote by device id (visible in the snapshot); device_token is a
    # fallback for callers that hold the token directly.
    device_id = serializers.UUIDField(required=False)
    device_token = serializers.UUIDField(required=False)
    version = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("device_id") and not attrs.get("device_token"):
            raise serializers.ValidationError("device_id or device_token is required.")
        return attrs


class ConfirmOrdersSerializer(serializers.Serializer):
    order_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class ContactSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class PayResultSerializer(serializers.Serializer):
    """The Razorpay order to hand to the client checkout (amounts server-set)."""

    order_id = serializers.CharField()
    amount_minor = serializers.IntegerField()
    currency = serializers.CharField()


class DisputeSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )


class ServiceRequestSerializer(serializers.ModelSerializer):
    """Read view of a guest service request for the staff queue / KDS."""

    table = serializers.UUIDField(source="table_id", read_only=True)

    class Meta:
        model = ServiceRequest
        fields = ["id", "session", "table", "kind", "status", "note", "created_at", "resolved_at"]
        read_only_fields = fields


class ServiceRequestCreateSerializer(serializers.Serializer):
    """Guest input to raise a service request."""

    kind = serializers.ChoiceField(
        choices=[v for v, _ in SERVICE_REQUEST_TYPE_CHOICES], default="waiter"
    )
    note = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )
