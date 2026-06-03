"""Loyalty point services — the append-only :class:`crm.models.LoyaltyLedger`
is the source of truth; ``Customer.points`` / ``Customer.tier`` are caches that
every mutation here keeps in lock-step with the sum of the ledger deltas.

All balance-changing operations run inside a DB transaction so the ledger row
and the cached balance can never drift apart on failure.
"""
from __future__ import annotations

from django.db import transaction
from django.db.models import Sum

from crm.models import Customer, LoyaltyLedger

#: Points awarded once, the first time a phone is enrolled.
WELCOME_BONUS_POINTS = 50

#: Tier thresholds (inclusive lower bounds), highest first.
_TIER_THRESHOLDS: tuple[tuple[int, str], ...] = (
    (2000, "Gold"),
    (500, "Silver"),
    (0, "Bronze"),
)


class LoyaltyError(Exception):
    """Raised on an invalid loyalty operation (e.g. over-redeeming points)."""


def tier_for(points: int) -> str:
    """Return the tier name for a point balance (>=2000 Gold, >=500 Silver)."""
    for threshold, name in _TIER_THRESHOLDS:
        if points >= threshold:
            return name
    return "Bronze"


def _append_ledger(
    customer: Customer,
    points_delta: int,
    *,
    reason: str,
    order_id: str | None = None,
) -> LoyaltyLedger:
    """Append one ledger row for ``customer`` (does not touch the cache)."""
    return LoyaltyLedger.objects.create(
        org_id=customer.org_id,
        customer=customer,
        order_id=order_id,
        points_delta=points_delta,
        reason=reason,
    )


def _ledger_sum(customer: Customer) -> int:
    """Return the authoritative balance: the sum of every ledger delta."""
    total = customer.ledger.aggregate(total=Sum("points_delta"))["total"]
    return total or 0


def _sync_cache(customer: Customer, points: int) -> Customer:
    """Write ``points`` + the derived tier onto the cached customer row."""
    customer.points = points
    customer.tier = tier_for(points)
    customer.save(update_fields=["points", "tier", "updated_at"])
    return customer


@transaction.atomic
def earn_points(
    customer: Customer,
    points: int,
    *,
    order_id: str | None = None,
    reason: str = "earn",
) -> Customer:
    """Credit ``points`` to ``customer``: append a ledger row, refresh cache."""
    if points <= 0:
        raise LoyaltyError("Points to earn must be positive.")
    _append_ledger(customer, points, reason=reason, order_id=order_id)
    return _sync_cache(customer, customer.points + points)


@transaction.atomic
def redeem_points(customer: Customer, points: int) -> Customer:
    """Debit ``points`` from ``customer``; reject an insufficient balance."""
    if points <= 0:
        raise LoyaltyError("Points to redeem must be positive.")
    if points > customer.points:
        raise LoyaltyError(
            f"Insufficient balance: {customer.points} available, {points} requested."
        )
    _append_ledger(customer, -points, reason="redeem")
    return _sync_cache(customer, customer.points - points)


@transaction.atomic
def recompute_balance(customer: Customer) -> Customer:
    """Rebuild the cached balance + tier from the ledger (cache-integrity tool)."""
    return _sync_cache(customer, _ledger_sum(customer))


@transaction.atomic
def enroll_customer(
    *,
    org_id: str,
    phone: str,
    name: str = "",
) -> tuple[Customer, bool]:
    """Get-or-create a customer by ``(org_id, phone)``.

    Returns ``(customer, created)``. A welcome bonus is granted exactly once,
    on first enrollment.
    """
    customer, created = Customer.objects.get_or_create(
        org_id=org_id,
        phone=phone,
        defaults={"name": name},
    )
    if created:
        earn_points(customer, WELCOME_BONUS_POINTS, reason="adjust")
    return customer, created
