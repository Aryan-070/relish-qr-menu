"""Billing domain models: subscriptions, invoices, and the idempotency ledger.

These are plain models keyed by ``org_id`` (a :class:`~django.db.models.UUIDField`)
rather than ``TenantScopedModel`` subclasses, because billing is the shared
control plane. Webhook handlers run with no bound tenant context and must be able
to resolve an invoice across orgs. A real ``Organization`` FK arrives in Phase 1.
"""
from __future__ import annotations

import uuid

from django.db import models


class Subscription(models.Model):
    """A recurring plan an organization is on."""

    class Package(models.TextChoices):
        WEB_MENU = "web-menu", "Web Menu"
        CLASSIC = "classic", "Classic"
        CINEMATIC = "cinematic", "Cinematic"
        SIGNATURE = "signature", "Signature"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        SUSPENDED = "suspended", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    package = models.CharField(max_length=16, choices=Package.choices)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    started_at = models.DateTimeField(auto_now_add=True)
    renewal_at = models.DateTimeField()
    auto_renew = models.BooleanField(default=True)
    gst_pct = models.IntegerField(default=18)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"{self.package} ({self.org_id})"


class Invoice(models.Model):
    """A single billable line for an organization, settled via Razorpay.

    Money is stored in integer **minor units** (paise). ``total_minor`` is the
    only amount ever charged — it is the server-side source of truth and must
    never be overridden by client input.
    """

    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        DUE = "due", "Due"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    org_id = models.UUIDField(db_index=True)
    subscription = models.ForeignKey(
        Subscription,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invoices",
    )
    description = models.TextField(blank=True)
    base_minor = models.IntegerField()
    gst_minor = models.IntegerField()
    total_minor = models.IntegerField()
    status = models.CharField(
        max_length=8, choices=Status.choices, default=Status.DUE
    )
    razorpay_id = models.CharField(  # noqa: DJ001 — matches Razorpay contract (nullable)
        max_length=64, null=True, blank=True
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-issued_at"]

    def __str__(self) -> str:
        return self.code


class PaymentEvent(models.Model):
    """Idempotency ledger for Razorpay webhook events.

    The ``razorpay_event_id`` unique constraint is what makes webhook processing
    exactly-once: an insert-or-skip on this row guards the side effect (marking
    an invoice paid). Rows are **never deleted** — they are the audit trail of
    every event we have already applied.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    razorpay_event_id = models.CharField(max_length=128, unique=True)
    invoice = models.ForeignKey(
        Invoice,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
    )
    kind = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self) -> str:
        return f"{self.kind}:{self.razorpay_event_id}"
