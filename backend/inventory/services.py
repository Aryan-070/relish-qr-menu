"""Inventory domain services — the only place stock balances are mutated.

Stock is a running balance on ``Ingredient.stock`` whose truth is the
append-only ``StockMovement`` ledger. Every balance change therefore goes
through :func:`adjust_stock`, which writes a signed ledger row AND applies the
matching ``F('stock') + delta`` increment in one transaction. Receiving a
purchase order and recording wastage are higher-level operations that fan out
to :func:`adjust_stock`.

Money is integer minor units; quantities are :class:`~decimal.Decimal`.
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from common.context import get_current_restaurant_id
from inventory.models import (
    Ingredient,
    PurchaseOrder,
    StockMovement,
    Wastage,
)


class InventoryError(Exception):
    """Raised when an inventory operation violates a domain invariant."""


def next_po_code(restaurant_id) -> str:
    """Return the next ``PO-NNNNN`` code for ``restaurant_id`` (5-digit, padded).

    The sequence is per-restaurant: it counts existing purchase orders for the
    tenant (including soft-deleted ones, so codes are never reused) and returns
    the next ordinal.
    """
    existing = PurchaseOrder.all_objects.filter(restaurant_id=restaurant_id).count()
    return f"PO-{existing + 1:05d}"


@transaction.atomic
def adjust_stock(
    *,
    ingredient: Ingredient,
    delta: Decimal,
    reason: str,
    ref_id=None,
) -> StockMovement:
    """Append a ``StockMovement`` and apply the matching balance increment.

    Writes a signed ledger row ``(delta, reason, ref_id)`` and atomically bumps
    ``ingredient.stock`` by ``delta`` using ``F('stock') + delta`` (race-safe).
    The passed ``ingredient`` instance is refreshed so its ``.stock`` reflects
    the new balance. Returns the created movement.
    """
    movement = StockMovement.objects.create(
        restaurant_id=ingredient.restaurant_id,
        ingredient=ingredient,
        delta=delta,
        reason=reason,
        ref_id=ref_id,
    )
    Ingredient.all_objects.filter(pk=ingredient.pk).update(
        stock=F("stock") + delta
    )
    ingredient.refresh_from_db(fields=["stock"])
    return movement


@transaction.atomic
def receive_purchase_order(po: PurchaseOrder) -> PurchaseOrder:
    """Receive ``po``: post a ``+qty`` purchase movement for every line.

    Guards against double-receipt (raises :class:`InventoryError` if already
    received). For each line it calls :func:`adjust_stock` with a positive
    delta and ``reason='purchase'``, references the PO via ``ref_id=po.id``,
    then flips the PO to ``received`` and stamps ``received_at``.
    """
    if po.status == "received":
        raise InventoryError("Purchase order has already been received.")

    for line in po.lines.all():
        adjust_stock(
            ingredient=line.ingredient,
            delta=line.qty,
            reason="purchase",
            ref_id=po.id,
        )

    po.status = "received"
    po.received_at = timezone.now()
    po.save(update_fields=["status", "received_at", "updated_at"])
    return po


@transaction.atomic
def record_wastage(
    *,
    ingredient: Ingredient,
    qty: Decimal,
    reason: str = "",
) -> Wastage:
    """Record a wastage event and deplete stock by ``qty``.

    Creates the ``Wastage`` row, then posts a ``-qty`` movement with
    ``reason='wastage'`` referencing the wastage row. Returns the wastage.
    """
    restaurant_id = ingredient.restaurant_id or get_current_restaurant_id()
    wastage = Wastage.objects.create(
        restaurant_id=restaurant_id,
        ingredient=ingredient,
        qty=qty,
        reason=reason,
    )
    adjust_stock(
        ingredient=ingredient,
        delta=-qty,
        reason="wastage",
        ref_id=wastage.id,
    )
    return wastage
