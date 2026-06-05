"""Dining-session domain: the spine that lets many guest devices share one
table, browse freely, and have ordering authority controlled by a configurable
policy rather than a hard-coded "menu leader".

Entities (all tenant-scoped via :class:`common.models.TenantScopedModel`):

* :class:`DiningSession` — one live session per table (enforced by a partial
  unique index). Carries an ``epoch`` that increments on table turnover; a
  guest's ``device_token`` is only valid for its own ``(session, epoch)``, so a
  stale QR / re-scan / device loss / turnover can never cross-contaminate the
  next party's bill. ``order_confirmation_mode`` decides who may fire orders.
* :class:`GuestDevice` — an anonymous device identity (opaque ``device_token``
  the browser stores in localStorage and sends as ``X-Device-Token``). No guest
  login; the join endpoint is the trust boundary. Optionally linked to a
  :class:`crm.Customer` once contact details are captured.
* :class:`Check` — the per-session money object (the tab). Orders attach to a
  session; the check aggregates them and is the single settlement object.

Money is integer minor units (paise), always computed server-side.
"""
from __future__ import annotations

import uuid

from django.db import models

from common.models import TenantScopedModel

from .constants import (
    CHECK_STATUS_CHOICES,
    DEFAULT_ORDER_CONFIRMATION_MODE,
    DEVICE_ROLE_CHOICES,
    LIVE_SESSION_STATUSES,
    ORDER_CONFIRMATION_MODE_CHOICES,
    SESSION_STATUS_CHOICES,
)


class DiningSession(TenantScopedModel):
    """A live dining session bound to one table for one seating."""

    table = models.ForeignKey(
        "ops.RestaurantTable",
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    status = models.CharField(
        max_length=16, choices=SESSION_STATUS_CHOICES, default="open"
    )
    #: Increments on every table turnover; part of a device token's validity.
    epoch = models.PositiveIntegerField(default=1)
    order_confirmation_mode = models.CharField(
        max_length=16,
        choices=ORDER_CONFIRMATION_MODE_CHOICES,
        default=DEFAULT_ORDER_CONFIRMATION_MODE,
    )
    #: Only meaningful in ``leader`` mode — the single device allowed to order.
    leader_device = models.ForeignKey(
        "dining.GuestDevice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    party_size = models.PositiveSmallIntegerField(default=0)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-opened_at"]
        constraints = [
            # At most one live session per table — the turnover/race guarantee.
            models.UniqueConstraint(
                fields=["table"],
                condition=models.Q(status__in=LIVE_SESSION_STATUSES),
                name="uniq_live_session_per_table",
            ),
        ]
        indexes = [
            models.Index(fields=["restaurant_id", "status"]),
        ]

    def __str__(self) -> str:
        return f"session:{self.table_id}#{self.epoch}({self.status})"

    @property
    def is_live(self) -> bool:
        return self.status in LIVE_SESSION_STATUSES


class GuestDevice(TenantScopedModel):
    """An anonymous guest device joined to a session."""

    session = models.ForeignKey(
        DiningSession, on_delete=models.CASCADE, related_name="devices"
    )
    #: The device secret — stored in the browser, sent as ``X-Device-Token``.
    device_token = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True
    )
    display_name = models.CharField(max_length=80, blank=True)
    customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    role = models.CharField(
        max_length=12, choices=DEVICE_ROLE_CHOICES, default="participant"
    )
    is_payer = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "role"]),
            models.Index(fields=["restaurant_id", "last_seen"]),
        ]

    def __str__(self) -> str:
        return f"device:{self.device_token}({self.role})"


class Check(TenantScopedModel):
    """The per-session money object (the tab) — single settlement record."""

    session = models.OneToOneField(
        DiningSession, on_delete=models.CASCADE, related_name="tab"
    )
    subtotal_minor = models.BigIntegerField(default=0)
    tax_minor = models.BigIntegerField(default=0)
    service_charge_minor = models.BigIntegerField(default=0)
    total_minor = models.BigIntegerField(default=0)
    paid_minor = models.BigIntegerField(default=0)
    status = models.CharField(
        max_length=16, choices=CHECK_STATUS_CHOICES, default="open"
    )
    #: Who owes the bill — set when contact is captured or at first payment.
    liable_customer = models.ForeignKey(
        "crm.Customer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    razorpay_order_id = models.CharField(max_length=80, blank=True)

    class Meta:
        constraints = [
            # Razorpay order ids are globally unique; enforce it for the non-empty
            # values so the webhook's fallback lookup is an indexed, unambiguous hit.
            models.UniqueConstraint(
                fields=["razorpay_order_id"],
                condition=~models.Q(razorpay_order_id=""),
                name="uniq_check_razorpay_order_id",
            ),
        ]

    def __str__(self) -> str:
        return f"check:{self.session_id}({self.status})"
