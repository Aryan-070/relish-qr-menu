"""Table-bill (Check) payment & liability services.

Reuses the billing slice's Razorpay plumbing — :func:`create_razorpay_order`
for order creation and the single idempotent webhook ledger (``PaymentEvent``)
for settlement, wired via the ``payment_event_applied`` signal. The dining slice
owns *what it means* to settle/dispute a Check; billing stays ignorant of it.

Money is integer paise, always computed server-side from the session's orders.
"""
from __future__ import annotations

import uuid
from typing import Any

from django.db import transaction

from billing.services import create_razorpay_order
from ops.models import AuditLog

from .models import Check, DiningSession
from .services import recompute_check

#: Receipt prefix that marks a Razorpay order/receipt as a dining Check (vs a
#: SaaS Invoice, whose receipts are ``INV-…``). Lets the shared webhook route.
CHECK_RECEIPT_PREFIX = "CHK-"


class CheckPaymentError(Exception):
    """Raised when a Check cannot be paid (empty bill, already settled, …)."""


def check_receipt(check: Check) -> str:
    """The Razorpay receipt string for ``check`` (``CHK-<uuid>``)."""
    return f"{CHECK_RECEIPT_PREFIX}{check.id}"


def _lock_check(session: DiningSession) -> Check | None:
    """Row-lock (``SELECT FOR UPDATE``) the session's check for safe mutation."""
    return Check.all_objects.select_for_update().filter(session=session).first()


def create_check_payment(session: DiningSession) -> dict[str, Any]:
    """Create a Razorpay order for the session's Check and return order details.

    Recomputes the Check (server-authoritative total) under a row lock, then
    makes the Razorpay network call **outside** the lock (it can take seconds),
    then re-locks to store the order id. Raises :class:`CheckPaymentError` for an
    empty / settled / disputed bill; propagates ``RazorpayConfigError`` when keys
    are unset (the view maps that to a 503).
    """
    with transaction.atomic():
        check = _lock_check(session)
        if check is None:
            raise CheckPaymentError("This session has no bill.")
        if check.status == "settled":
            raise CheckPaymentError("This bill is already settled.")
        if check.status == "disputed":
            raise CheckPaymentError("This bill is disputed; resolve it first.")
        recompute_check(session, check=check)
        if check.total_minor <= 0:
            raise CheckPaymentError("There is nothing to pay yet.")
        amount_minor = check.total_minor
        receipt = check_receipt(check)
        check_id = check.id

    # Network call held outside the row lock so a slow Razorpay response never
    # blocks other writers on this check.
    order = create_razorpay_order(amount_minor, receipt)
    order_id = order.get("id", "")

    with transaction.atomic():
        locked = Check.all_objects.select_for_update().filter(pk=check_id).first()
        if locked is not None:
            locked.razorpay_order_id = order_id
            locked.save(update_fields=["razorpay_order_id", "updated_at"])
    return {"order_id": order_id, "amount_minor": amount_minor, "currency": "INR"}


def _check_from_payload(payload: dict[str, Any]) -> Check | None:
    """Resolve the dining Check a webhook entity refers to, or ``None``.

    Mirrors billing's resolver: tries the ``CHK-<uuid>`` receipt / notes, then
    falls back to matching the stored ``razorpay_order_id``. Uses ``all_objects``
    (cross-tenant, includes soft-deleted) deliberately: the webhook has no tenant
    context, the ``CHK-<uuid>`` is unguessable, and the request is already gated
    by the Razorpay HMAC signature — so a UUID match uniquely identifies the one
    correct check, and a closed/archived session still needs settling.
    """
    candidates: list[str] = []
    receipt = payload.get("receipt")
    if isinstance(receipt, str):
        candidates.append(receipt)
    notes = payload.get("notes")
    if isinstance(notes, dict):
        note_id = notes.get("invoiceId")
        if isinstance(note_id, str):
            candidates.append(note_id)

    for value in candidates:
        if value.startswith(CHECK_RECEIPT_PREFIX):
            raw = value[len(CHECK_RECEIPT_PREFIX):]
            try:
                check_id = uuid.UUID(raw)
            except ValueError:
                continue
            check = Check.all_objects.filter(pk=check_id).first()
            if check is not None:
                return check

    entity_id = payload.get("id")
    if isinstance(entity_id, str) and entity_id:
        return Check.all_objects.filter(razorpay_order_id=entity_id).first()
    return None


def settle_check_from_payload(payload: dict[str, Any]) -> Check | None:
    """Mark the Check a paid-webhook refers to as settled (idempotent).

    Called from the ``payment_event_applied`` signal, which billing fires only
    once per event (post-commit). Re-locks and re-checks status so a concurrent
    manual settle and the webhook can't double-apply.
    """
    resolved = _check_from_payload(payload)
    if resolved is None:
        return None
    with transaction.atomic():
        check = Check.all_objects.select_for_update().filter(pk=resolved.id).first()
        if check is None or check.status == "settled":
            return check
        check.paid_minor = check.total_minor
        check.status = "settled"
        check.save(update_fields=["paid_minor", "status", "updated_at"])
    return check


@transaction.atomic
def settle_check_cash(session: DiningSession, actor_membership_id: Any | None) -> Check:
    """Staff settles the bill in cash/at the counter; audited (idempotent-safe)."""
    check = _lock_check(session)
    if check is None:
        raise CheckPaymentError("This session has no bill.")
    if check.status == "settled":
        raise CheckPaymentError("This bill is already settled.")
    if check.status == "disputed":
        raise CheckPaymentError("This bill is disputed; resolve it first.")
    recompute_check(session, check=check)
    before = {"status": check.status, "paid_minor": check.paid_minor}
    check.paid_minor = check.total_minor
    check.status = "settled"
    check.save(update_fields=["paid_minor", "status", "updated_at"])
    AuditLog.objects.create(
        restaurant_id=check.restaurant_id,
        type="payment",
        table_id=session.table_id,
        actor_membership_id=actor_membership_id,
        amount_minor=check.total_minor,
        reason="cash",
        before=before,
        after={"status": check.status, "paid_minor": check.paid_minor},
    )
    return check


@transaction.atomic
def mark_check_disputed(
    session: DiningSession, actor_membership_id: Any | None, reason: str = ""
) -> Check:
    """Flag the Check disputed (walkout / chargeback / contested line); audited."""
    check = _lock_check(session)
    if check is None:
        raise CheckPaymentError("This session has no bill.")
    if check.status in ("settled", "disputed"):
        raise CheckPaymentError(f"Cannot dispute a {check.status} bill.")
    before = {"status": check.status}
    check.status = "disputed"
    check.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        restaurant_id=check.restaurant_id,
        type="dispute",
        table_id=session.table_id,
        actor_membership_id=actor_membership_id,
        amount_minor=check.total_minor - check.paid_minor,
        reason=reason or "",
        before=before,
        after={"status": check.status},
    )
    return check
