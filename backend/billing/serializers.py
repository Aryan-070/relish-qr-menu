"""DRF serializers for the billing slice."""
from __future__ import annotations

from rest_framework import serializers

from billing.models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    """Read-only representation of an invoice."""

    class Meta:
        model = Invoice
        fields = [
            "id",
            "code",
            "org_id",
            "subscription",
            "description",
            "base_minor",
            "gst_minor",
            "total_minor",
            "status",
            "razorpay_id",
            "issued_at",
            "paid_at",
        ]
        read_only_fields = fields


class CreateOrderSerializer(serializers.Serializer):
    """Input for creating a Razorpay order.

    Only the invoice id is accepted; the charge amount is derived server-side
    from the invoice and is intentionally **not** part of this contract.
    """

    invoice_id = serializers.UUIDField()
