"""Operational domain: floor tables, orders, service requests, governance audit.

Tenant-scoped via ``common.models.TenantScopedModel`` (UUID pk, indexed
``restaurant_id``, timestamps, soft-delete, tenant-filtering manager). Money is
integer minor units (paise). Order lines and line modifiers are **snapshots** —
they record the name/price at time of sale so historical orders never mutate
when the menu changes (``menu_item``/``modifier`` are nullable provenance FKs).
"""
import uuid

from django.db import models

from common.models import TenantScopedModel, TimeStampedModel

# ── Choice sets ─────────────────────────────────────────────────────────────
ZONE_CHOICES = (
    ("Garden", "Garden"),
    ("Indoor", "Indoor"),
    ("Patio", "Patio"),
    ("Bar", "Bar"),
)
TABLE_STATUS_CHOICES = (
    ("available", "Available"),
    ("seated", "Seated"),
    ("ordering", "Ordering"),
    ("bill-requested", "Bill requested"),
    ("needs-attention", "Needs attention"),
)
ORDER_STATUS_CHOICES = (
    ("new", "New"),
    ("preparing", "Preparing"),
    ("ready", "Ready"),
    ("served", "Served"),
)
ORDER_SOURCE_CHOICES = (("guest", "Guest"), ("staff", "Staff"))
REQUEST_TYPE_CHOICES = (
    ("waiter", "Waiter"),
    ("water", "Water"),
    ("bill", "Bill"),
    ("assistance", "Assistance"),
    ("cleanup", "Cleanup"),
)
REQUEST_STATUS_CHOICES = (
    ("pending", "Pending"),
    ("claimed", "Claimed"),
    ("resolved", "Resolved"),
)
AUDIT_TYPE_CHOICES = (
    ("void", "Void"),
    ("comp", "Comp"),
    ("discount", "Discount"),
    ("merge", "Merge"),
    ("transfer", "Transfer"),
    ("price-change", "Price change"),
    ("role-change", "Role change"),
)


class RestaurantTable(TenantScopedModel):
    code = models.CharField(max_length=40)
    label = models.CharField(max_length=80)
    seats = models.PositiveSmallIntegerField(default=2)
    zone = models.CharField(max_length=20, choices=ZONE_CHOICES, default="Indoor")
    status = models.CharField(
        max_length=20, choices=TABLE_STATUS_CHOICES, default="available"
    )
    waiter_membership = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tables",
    )
    guests = models.PositiveSmallIntegerField(default=0)
    seated_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant_id", "code"], name="uniq_table_restaurant_code"
            ),
        ]

    def __str__(self) -> str:
        return self.label or self.code


class Order(TenantScopedModel):
    code = models.CharField(max_length=40)
    table = models.ForeignKey(
        RestaurantTable,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    waiter_membership = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    # FK to crm.Customer arrives with the CRM increment; interim nullable UUID.
    customer_id = models.UUIDField(null=True, blank=True)
    source = models.CharField(
        max_length=10, choices=ORDER_SOURCE_CHOICES, default="staff"
    )
    status = models.CharField(
        max_length=12, choices=ORDER_STATUS_CHOICES, default="new"
    )
    subtotal_minor = models.IntegerField(default=0)
    discount_pct = models.PositiveSmallIntegerField(default=0)
    tax_minor = models.IntegerField(default=0)
    total_minor = models.IntegerField(default=0)
    paid = models.BooleanField(default=False)
    voided = models.BooleanField(default=False)
    comp = models.BooleanField(default=False)
    placed_at = models.DateTimeField(auto_now_add=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-placed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant_id", "code"], name="uniq_order_restaurant_code"
            ),
        ]
        indexes = [
            models.Index(
                fields=["restaurant_id", "table"],
                name="ops_order_open_idx",
                condition=models.Q(status__in=["new", "preparing", "ready"]),
            ),
            models.Index(fields=["restaurant_id", "-placed_at"]),
        ]

    def __str__(self) -> str:
        return self.code


class OrderLine(models.Model):
    """A sold line — a snapshot of the item at order time."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant_id = models.UUIDField(db_index=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_lines",
    )
    item_name = models.CharField(max_length=160)
    unit_price_minor = models.IntegerField()
    qty = models.PositiveIntegerField(default=1)
    category_id = models.UUIDField(null=True, blank=True)
    seat = models.PositiveSmallIntegerField(null=True, blank=True)
    note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.qty}× {self.item_name}"


class OrderLineModifier(models.Model):
    """A selected modifier on an order line — also a snapshot."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant_id = models.UUIDField(db_index=True)
    order_line = models.ForeignKey(
        OrderLine, on_delete=models.CASCADE, related_name="modifiers"
    )
    modifier = models.ForeignKey(
        "menu.Modifier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_line_modifiers",
    )
    label = models.CharField(max_length=120)
    price_delta_minor = models.IntegerField(default=0)

    def __str__(self) -> str:
        return self.label


class ServiceRequest(TenantScopedModel):
    code = models.CharField(max_length=40)
    table = models.ForeignKey(
        RestaurantTable, on_delete=models.CASCADE, related_name="requests"
    )
    type = models.CharField(max_length=12, choices=REQUEST_TYPE_CHOICES)
    status = models.CharField(
        max_length=10, choices=REQUEST_STATUS_CHOICES, default="pending"
    )
    claimed_by_membership = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_requests",
    )
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["restaurant_id", "-created_at"],
                name="ops_req_pending_idx",
                condition=models.Q(status="pending"),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.type}@{self.table_id}"


class AuditLog(TimeStampedModel):
    """Append-only governance log (voids, comps, discounts, transfers …)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant_id = models.UUIDField(db_index=True)
    type = models.CharField(max_length=16, choices=AUDIT_TYPE_CHOICES)
    order = models.ForeignKey(
        Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="audits"
    )
    table_id = models.UUIDField(null=True, blank=True)
    actor_membership = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_entries",
    )
    amount_minor = models.IntegerField(null=True, blank=True)
    reason = models.CharField(max_length=300, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["restaurant_id", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.type}:{self.order_id}"
