"""Django admin registrations for the billing slice.

:class:`~billing.models.PaymentEvent` is the idempotency ledger and is exposed
read-only (no add/edit/delete) so the audit trail cannot be tampered with from
the admin.
"""
from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from billing.models import Invoice, PaymentEvent, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "org_id", "package", "status", "renewal_at", "auto_renew")
    list_filter = ("package", "status", "auto_renew")
    search_fields = ("org_id",)
    readonly_fields = ("id", "started_at")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("code", "org_id", "status", "total_minor", "issued_at", "paid_at")
    list_filter = ("status",)
    search_fields = ("code", "org_id", "razorpay_id")
    readonly_fields = ("id", "issued_at")


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display = ("razorpay_event_id", "kind", "invoice", "received_at")
    list_filter = ("kind",)
    search_fields = ("razorpay_event_id",)
    readonly_fields = (
        "id",
        "razorpay_event_id",
        "invoice",
        "kind",
        "payload",
        "received_at",
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: object = None
    ) -> bool:
        return False

    def has_delete_permission(
        self, request: HttpRequest, obj: object = None
    ) -> bool:
        return False
