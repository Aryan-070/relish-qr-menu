"""Dining-session services — the only place session/ordering authority is
decided. Views are thin; this module owns the lifecycle, the epoch/turnover
invariant, the three ordering-confirmation modes, and check recomputation.

Guest traffic carries no JWT, so nothing here relies on a bound tenant: every
query is scoped explicitly by ``restaurant_id`` via ``all_objects`` (the same
pattern :func:`ops.services.place_order` uses to resolve the menu).
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from ops.models import Order, RestaurantTable
from ops.services import place_order

from .constants import LIVE_SESSION_STATUSES
from .models import Check, DiningSession, GuestDevice


class SessionError(Exception):
    """Raised when a session action is invalid (closed, wrong table, etc.)."""


# ── Join / presence ──────────────────────────────────────────────────────────
@transaction.atomic
def join_session(
    *, restaurant_id: Any, table_id: Any, display_name: str = ""
) -> tuple[DiningSession, GuestDevice, bool]:
    """Get-or-create the live session for a table and register a new device.

    Race-safe: we ``select_for_update`` the table row so eight simultaneous
    scans converge on one session rather than racing to create several. Returns
    ``(session, device, created_session)``.
    """
    table = (
        RestaurantTable.all_objects.select_for_update()
        .filter(restaurant_id=restaurant_id, id=table_id, deleted_at__isnull=True)
        .first()
    )
    if table is None:
        raise SessionError("Table not found for this restaurant.")

    session = (
        DiningSession.all_objects.select_for_update()
        .filter(
            restaurant_id=restaurant_id,
            table_id=table_id,
            status__in=LIVE_SESSION_STATUSES,
        )
        .first()
    )
    created_session = False
    if session is None:
        # New seating: epoch is one past the highest epoch this table has seen,
        # so a stale device_token from the previous party can never match.
        last_epoch = (
            DiningSession.all_objects.filter(
                restaurant_id=restaurant_id, table_id=table_id
            )
            .order_by("-epoch")
            .values_list("epoch", flat=True)
            .first()
        )
        session = DiningSession.objects.create(
            restaurant_id=restaurant_id,
            table_id=table_id,
            status="open",
            epoch=(last_epoch or 0) + 1,
        )
        Check.objects.create(restaurant_id=restaurant_id, session=session)
        created_session = True

    device = GuestDevice.objects.create(
        restaurant_id=restaurant_id,
        session=session,
        display_name=display_name,
        last_seen=timezone.now(),
    )
    session.party_size = session.devices.count()
    session.save(update_fields=["party_size", "updated_at"])
    return session, device, created_session


def touch_device(device: GuestDevice) -> None:
    """Update a device's presence heartbeat (called on each poll)."""
    device.last_seen = timezone.now()
    device.save(update_fields=["last_seen", "updated_at"])


def find_device(session: DiningSession, device_token: Any) -> GuestDevice | None:
    """Return the device for ``device_token`` *within this session*, or None.

    The session scoping is the turnover guard: a token from a prior epoch points
    at a different (closed) session, so it will not resolve here.
    """
    if not device_token:
        return None
    return GuestDevice.all_objects.filter(
        session=session, device_token=device_token
    ).first()


def device_can_order(session: DiningSession, device: GuestDevice | None) -> bool:
    """Whether ``device`` may submit an order under the session's policy.

    This is the authoritative rule the DRF permission and the service both use.
    """
    if device is None or not session.is_live:
        return False
    mode = session.order_confirmation_mode
    if mode == "auto_fire":
        return True
    if mode == "waiter_confirm":
        return True  # anyone may submit; it lands as pending_confirmation
    if mode == "leader":
        return session.leader_device_id == device.id or device.role == "leader"
    return False


# ── Ordering ──────────────────────────────────────────────────────────────────
@transaction.atomic
def submit_order(
    *,
    session: DiningSession,
    device: GuestDevice,
    lines: Iterable[Mapping[str, Any]],
    idempotency_key: str = "",
) -> Order:
    """Submit an order for ``device`` honoring the session's confirmation mode.

    ``auto_fire`` / ``leader`` → ``confirmed`` (enters the kitchen pipeline).
    ``waiter_confirm`` → ``pending_confirmation`` (a staffer fires it later).
    Idempotent on ``(session, idempotency_key)`` — a retried submit returns the
    existing order instead of duplicating it.
    """
    if not device_can_order(session, device):
        raise SessionError("This device is not allowed to order in this session.")

    if idempotency_key:
        existing = Order.all_objects.filter(
            session=session, idempotency_key=idempotency_key
        ).first()
        if existing is not None:
            return existing

    confirmation = (
        "pending_confirmation"
        if session.order_confirmation_mode == "waiter_confirm"
        else "confirmed"
    )
    try:
        order = place_order(
            restaurant_id=session.restaurant_id,
            table_id=session.table_id,
            source="guest",
            lines=lines,
            session_id=session.id,
            participant_id=device.id,
            confirmation=confirmation,
            idempotency_key=idempotency_key,
        )
    except IntegrityError:
        # Concurrent duplicate submit raced past the pre-check — return the winner.
        existing = Order.all_objects.filter(
            session=session, idempotency_key=idempotency_key
        ).first()
        if existing is not None:
            return existing
        raise

    if session.status == "open":
        session.status = "ordering"
        session.version += 1
        session.save(update_fields=["status", "version", "updated_at"])

    recompute_check(session)
    return order


@transaction.atomic
def promote_device(
    *,
    session: DiningSession,
    device: GuestDevice,
    expected_version: int | None = None,
) -> DiningSession:
    """Anoint ``device`` as the session's leader (the ``leader`` mode flow).

    Version-checked so two near-simultaneous promotes can't both win — the
    second sees a stale ``version`` and raises, surfacing as a 409 in the view.
    """
    if not session.is_live:
        raise SessionError("Cannot promote a device in a closed session.")
    if expected_version is not None and expected_version != session.version:
        raise SessionError("stale_version")

    # Demote any current leader, then anoint the new one.
    GuestDevice.all_objects.filter(session=session, role="leader").update(
        role="participant"
    )
    device.role = "leader"
    device.save(update_fields=["role", "updated_at"])

    session.leader_device = device
    session.version += 1
    session.save(update_fields=["leader_device", "version", "updated_at"])
    return session


@transaction.atomic
def confirm_orders(*, session: DiningSession, order_ids: Iterable[Any]) -> list[Order]:
    """Fire pending orders (the ``waiter_confirm`` batch). Returns the fired set."""
    pending = list(
        Order.all_objects.filter(
            session=session,
            confirmation="pending_confirmation",
            id__in=list(order_ids),
        )
    )
    for order in pending:
        order.confirmation = "confirmed"
        order.version += 1
        order.save(update_fields=["confirmation", "version", "updated_at"])
    return pending


# ── Contact capture / bill / close ────────────────────────────────────────────
@transaction.atomic
def attach_customer(
    *, session: DiningSession, device: GuestDevice, org_id: Any, phone: str, name: str = ""
) -> GuestDevice:
    """Resolve-or-create a CRM customer and link it to device + check liability."""
    # Imported lazily so the dining app has no hard import-time dep on crm.
    from crm.loyalty_services import enroll_customer

    customer, _created = enroll_customer(org_id=str(org_id), phone=phone, name=name)
    device.customer = customer
    device.is_payer = True
    device.save(update_fields=["customer", "is_payer", "updated_at"])

    check = getattr(session, "tab", None)
    if check is not None and check.liable_customer_id is None:
        check.liable_customer = customer
        check.save(update_fields=["liable_customer", "updated_at"])
    return device


@transaction.atomic
def request_bill(*, session: DiningSession) -> DiningSession:
    """Move the session to ``bill_requested`` and ensure the check is current."""
    if not session.is_live:
        raise SessionError("Session is not live.")
    recompute_check(session)
    session.status = "bill_requested"
    session.version += 1
    session.save(update_fields=["status", "version", "updated_at"])
    return session


@transaction.atomic
def close_session(*, session: DiningSession) -> DiningSession:
    """Close the session and free the table. Next scan starts a fresh epoch."""
    recompute_check(session)
    session.status = "closed"
    session.closed_at = timezone.now()
    session.version += 1
    session.save(update_fields=["status", "closed_at", "version", "updated_at"])

    table = RestaurantTable.all_objects.filter(pk=session.table_id).first()
    if table is not None:
        table.status = "available"
        table.guests = 0
        table.seated_at = None
        table.version += 1
        table.save(
            update_fields=["status", "guests", "seated_at", "version", "updated_at"]
        )
    return session


def recompute_check(
    session: DiningSession, check: Check | None = None
) -> Check | None:
    """Recompute the check totals from this session's non-voided orders.

    Pass ``check`` to operate on an already-fetched (e.g. row-locked) instance;
    otherwise the session's related check is used.
    """
    if check is None:
        check = getattr(session, "tab", None)
    if check is None:
        return None
    orders = Order.all_objects.filter(session=session, voided=False)
    agg = orders.aggregate(
        subtotal=Sum("subtotal_minor"),
        tax=Sum("tax_minor"),
        total=Sum("total_minor"),
    )
    check.subtotal_minor = agg["subtotal"] or 0
    check.tax_minor = agg["tax"] or 0
    check.total_minor = (agg["total"] or 0) + check.service_charge_minor
    check.save(
        update_fields=[
            "subtotal_minor",
            "tax_minor",
            "total_minor",
            "updated_at",
        ]
    )
    return check
