"""CRM domain.

Customers are **org-scoped** (a chain knows a guest across outlets) and so use a
plain ``org_id`` + explicit org filtering in views — NOT the restaurant-scoped
``TenantScopedModel``. Their loyalty balance is a *cache*; the truth is the
append-only ``LoyaltyLedger``. Reservations, waitlist and feedback are
per-outlet and use ``TenantScopedModel``.
"""
import uuid

from django.db import models

from common.models import TenantScopedModel, TimeStampedModel

TIER_CHOICES = (("Bronze", "Bronze"), ("Silver", "Silver"), ("Gold", "Gold"))
LEDGER_REASON_CHOICES = (
    ("earn", "Earn"),
    ("redeem", "Redeem"),
    ("adjust", "Adjust"),
    ("expire", "Expire"),
)
RESERVATION_STATUS_CHOICES = (
    ("booked", "Booked"),
    ("seated", "Seated"),
    ("completed", "Completed"),
    ("cancelled", "Cancelled"),
    ("no-show", "No-show"),
)
WAIT_STATUS_CHOICES = (
    ("waiting", "Waiting"),
    ("notified", "Notified"),
    ("seated", "Seated"),
    ("left", "Left"),
)


class Customer(TimeStampedModel):
    """Org-wide loyalty/CRM record, identified by phone (per org)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20)
    #: Birthday for campaigns. Day+month only — stored with a fixed sentinel
    #: year (2000, leap-safe); query by month/day and ignore the year.
    birth_date = models.DateField(null=True, blank=True)
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default="Bronze")
    points = models.IntegerField(default=0)  # cached balance (truth = ledger)
    visits = models.IntegerField(default=0)
    lifetime_spend_minor = models.BigIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    last_visit = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_visit"]
        constraints = [
            models.UniqueConstraint(
                fields=["org_id", "phone"], name="uniq_customer_org_phone"
            ),
        ]

    def __str__(self) -> str:
        return self.name or self.phone


class CustomerOutlet(models.Model):
    """Per-outlet visit stats for an org-wide customer."""

    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="outlets"
    )
    restaurant_id = models.UUIDField(db_index=True)
    visits = models.IntegerField(default=0)
    first_visit = models.DateTimeField(null=True, blank=True)
    last_visit = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "restaurant_id"], name="uniq_customer_outlet"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.customer_id}@{self.restaurant_id}"


class LoyaltyLedger(TimeStampedModel):
    """Append-only point-transaction log — the source of truth for balances."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True)
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="ledger"
    )
    order_id = models.UUIDField(null=True, blank=True)
    points_delta = models.IntegerField()
    reason = models.CharField(max_length=10, choices=LEDGER_REASON_CHOICES)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["customer", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.customer_id}:{self.points_delta:+d}"


class Reservation(TenantScopedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservations",
    )
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    party_size = models.PositiveSmallIntegerField()
    at = models.DateTimeField()
    table_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=RESERVATION_STATUS_CHOICES, default="booked"
    )
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["at"]
        indexes = [models.Index(fields=["restaurant_id", "at"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.party_size})"


class WaitlistEntry(TenantScopedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waitlist_entries",
    )
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    party_size = models.PositiveSmallIntegerField()
    quoted_mins = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=10, choices=WAIT_STATUS_CHOICES, default="waiting"
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["added_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.party_size})"


class Feedback(TenantScopedModel):
    order_id = models.UUIDField(null=True, blank=True)
    table_id = models.UUIDField(null=True, blank=True)
    rating = models.PositiveSmallIntegerField()  # 1..5
    comment = models.TextField(blank=True)
    routed_to_public = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["restaurant_id", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.rating}★"
