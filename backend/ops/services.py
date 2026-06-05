"""Order domain services — the ONLY place order money is computed.

Security invariant: **all pricing is derived server-side from the menu**. The
caller supplies ``menu_item_id`` / ``qty`` / ``modifier_id`` references only;
this module fetches the authoritative ``MenuItem`` / ``Modifier`` rows (scoped
to the active restaurant), snapshots their name + price into the order lines,
and computes line / subtotal / tax / total. A client-supplied ``price`` or
``total`` never reaches here — and even if it did, it is ignored.

Governance helpers (:func:`void_order`, :func:`comp_order`,
:func:`apply_discount`) each mutate the order and append an immutable
:class:`ops.models.AuditLog` row capturing actor, amount, reason and
before/after JSON snapshots.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from django.db import transaction

from menu.models import MenuItem, Modifier
from ops.models import AuditLog, Order, OrderLine, OrderLineModifier


class OrderError(Exception):
    """Raised when an order cannot be placed or governed (bad item, etc.)."""


def record_price_change(
    *,
    restaurant_id: Any,
    menu_item_id: Any,
    before: Mapping[str, Any],
    after: Mapping[str, Any],
    actor_membership_id: Any | None = None,
) -> AuditLog:
    """Append an immutable ``price-change`` audit row for a menu-item edit.

    Called from ``menu.views.MenuItemViewSet`` (lazily, to avoid a menu→ops
    import cycle) whenever an item's price or tax rate changes.
    """
    return AuditLog.objects.create(
        restaurant_id=restaurant_id,
        type="price-change",
        actor_membership_id=actor_membership_id,
        before=dict(before),
        after=dict(after),
        reason=f"menu_item:{menu_item_id}",
    )


def next_order_code(restaurant_id: Any) -> str:
    """Return the next ``ORD-00001`` style code for ``restaurant_id``.

    Codes are sequential per restaurant. We derive the next ordinal from the
    highest existing numeric suffix so soft-deleted/voided orders never collide
    on the ``(restaurant_id, code)`` unique constraint.
    """
    existing = (
        Order.all_objects.filter(restaurant_id=restaurant_id, code__startswith="ORD-")
        .values_list("code", flat=True)
    )
    highest = 0
    for code in existing:
        suffix = code.rsplit("-", 1)[-1]
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return f"ORD-{highest + 1:05d}"


def _resolve_menu_item(restaurant_id: Any, menu_item_id: Any) -> MenuItem:
    """Fetch an available menu item belonging to ``restaurant_id`` or raise."""
    item = (
        MenuItem.all_objects.filter(restaurant_id=restaurant_id, id=menu_item_id)
        .first()
    )
    if item is None or item.deleted_at is not None:
        raise OrderError(f"Menu item {menu_item_id} not found for this restaurant.")
    if not item.available or item.sold_out:
        raise OrderError(f"Menu item '{item.name}' is not available.")
    return item


def _resolve_modifier(restaurant_id: Any, modifier_id: Any) -> Modifier:
    """Fetch a modifier belonging to ``restaurant_id`` or raise."""
    modifier = (
        Modifier.all_objects.filter(restaurant_id=restaurant_id, id=modifier_id)
        .first()
    )
    if modifier is None or modifier.deleted_at is not None:
        raise OrderError(f"Modifier {modifier_id} not found for this restaurant.")
    return modifier


def _recompute_total(order: Order) -> int:
    """Return ``(subtotal + tax)`` reduced by ``discount_pct`` (integer paise)."""
    gross = order.subtotal_minor + order.tax_minor
    if order.discount_pct:
        discount = gross * order.discount_pct // 100
        return gross - discount
    return gross


@transaction.atomic
def place_order(
    *,
    restaurant_id: Any,
    table_id: Any | None = None,
    waiter_membership_id: Any | None = None,
    source: str = "staff",
    lines: Iterable[Mapping[str, Any]],
    session_id: Any | None = None,
    participant_id: Any | None = None,
    customer_id: Any | None = None,
    confirmation: str = "confirmed",
    idempotency_key: str = "",
) -> Order:
    """Create an order, computing every money field server-side.

    ``lines`` is an iterable of mappings shaped like::

        {"menu_item_id": <uuid>, "qty": <int>, "modifier_ids": [<uuid>, ...],
         "seat": <int|None>, "note": <str>}

    For each line we snapshot the item name + ``price_minor`` and each modifier
    label + ``price_delta_minor``, then compute::

        line_total = (unit_price + Σ modifier deltas) * qty

    Subtotal is the sum of line totals; tax is the sum of per-item
    ``price_minor * qty * tax_rate_pct / 100`` (integer-rounded); total is
    ``subtotal + tax``. Any ``price``/``total`` present on the input is ignored.
    """
    resolved: list[dict[str, Any]] = []
    subtotal_minor = 0
    tax_minor = 0

    for raw in lines:
        menu_item = _resolve_menu_item(restaurant_id, raw["menu_item_id"])
        qty = int(raw.get("qty", 1))
        if qty < 1:
            raise OrderError("Line quantity must be at least 1.")

        modifiers: list[Modifier] = [
            _resolve_modifier(restaurant_id, modifier_id)
            for modifier_id in raw.get("modifier_ids", []) or []
        ]
        modifier_delta = sum(m.price_delta_minor for m in modifiers)

        unit_price = menu_item.price_minor
        line_total = (unit_price + modifier_delta) * qty
        subtotal_minor += line_total
        tax_minor += unit_price * qty * menu_item.tax_rate_pct // 100

        resolved.append(
            {
                "menu_item": menu_item,
                "unit_price": unit_price,
                "qty": qty,
                "seat": raw.get("seat"),
                "note": raw.get("note", "") or "",
                "modifiers": modifiers,
            }
        )

    if not resolved:
        raise OrderError("An order must contain at least one line.")

    order = Order.objects.create(
        restaurant_id=restaurant_id,
        code=next_order_code(restaurant_id),
        table_id=table_id,
        waiter_membership_id=waiter_membership_id,
        session_id=session_id,
        participant_id=participant_id,
        customer_id=customer_id,
        confirmation=confirmation,
        idempotency_key=idempotency_key,
        source=source,
        status="new",
        subtotal_minor=subtotal_minor,
        discount_pct=0,
        tax_minor=tax_minor,
        total_minor=subtotal_minor + tax_minor,
    )

    for line in resolved:
        order_line = OrderLine.objects.create(
            restaurant_id=restaurant_id,
            order=order,
            participant_id=participant_id,
            menu_item=line["menu_item"],
            item_name=line["menu_item"].name,
            unit_price_minor=line["unit_price"],
            qty=line["qty"],
            category_id=line["menu_item"].category_id,
            seat=line["seat"],
            note=line["note"],
        )
        for modifier in line["modifiers"]:
            OrderLineModifier.objects.create(
                restaurant_id=restaurant_id,
                order_line=order_line,
                modifier=modifier,
                label=modifier.label,
                price_delta_minor=modifier.price_delta_minor,
            )

    return order


def _order_money_snapshot(order: Order) -> dict[str, Any]:
    """Return the governable money/state fields of ``order`` as plain JSON."""
    return {
        "subtotal_minor": order.subtotal_minor,
        "discount_pct": order.discount_pct,
        "tax_minor": order.tax_minor,
        "total_minor": order.total_minor,
        "voided": order.voided,
        "comp": order.comp,
        "status": order.status,
    }


@transaction.atomic
def void_order(order: Order, actor_membership_id: Any | None, reason: str = "") -> Order:
    """Mark ``order`` voided, record an audit row, and return it."""
    before = _order_money_snapshot(order)
    order.voided = True
    order.version += 1
    order.save(update_fields=["voided", "version", "updated_at"])

    AuditLog.objects.create(
        restaurant_id=order.restaurant_id,
        type="void",
        order=order,
        table_id=order.table_id,
        actor_membership_id=actor_membership_id,
        amount_minor=order.total_minor,
        reason=reason or "",
        before=before,
        after=_order_money_snapshot(order),
    )
    return order


@transaction.atomic
def comp_order(order: Order, actor_membership_id: Any | None, reason: str = "") -> Order:
    """Comp ``order`` (total → 0, ``comp=True``), audit it, and return it."""
    before = _order_money_snapshot(order)
    comped_amount = order.total_minor
    order.comp = True
    order.total_minor = 0
    order.version += 1
    order.save(update_fields=["comp", "total_minor", "version", "updated_at"])

    AuditLog.objects.create(
        restaurant_id=order.restaurant_id,
        type="comp",
        order=order,
        table_id=order.table_id,
        actor_membership_id=actor_membership_id,
        amount_minor=comped_amount,
        reason=reason or "",
        before=before,
        after=_order_money_snapshot(order),
    )
    return order


@transaction.atomic
def apply_discount(
    order: Order,
    pct: int,
    actor_membership_id: Any | None,
    reason: str = "",
) -> Order:
    """Apply a percentage discount, recompute total, audit it, and return it."""
    pct = int(pct)
    if pct < 0 or pct > 100:
        raise OrderError("Discount percent must be between 0 and 100.")

    before = _order_money_snapshot(order)
    order.discount_pct = pct
    order.total_minor = _recompute_total(order)
    order.version += 1
    order.save(update_fields=["discount_pct", "total_minor", "version", "updated_at"])

    discount_amount = before["total_minor"] - order.total_minor
    AuditLog.objects.create(
        restaurant_id=order.restaurant_id,
        type="discount",
        order=order,
        table_id=order.table_id,
        actor_membership_id=actor_membership_id,
        amount_minor=discount_amount,
        reason=reason or "",
        before=before,
        after=_order_money_snapshot(order),
    )
    return order
