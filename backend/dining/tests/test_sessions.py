"""Dining-session tests — the load-bearing invariants from the architecture:

* one live session per table (concurrent scans converge, not race);
* the three ordering-confirmation modes are enforced **server-side** (a
  non-leader device physically cannot fire an order in ``leader`` mode);
* the epoch/turnover guard kills a stale device token after the table closes;
* order submission is idempotent on the ``Idempotency-Key`` header.

Guest endpoints carry no JWT — identity is the ``X-Device-Token`` header minted
at join. Staff endpoints run the real JWT + tenant middleware (no
``force_authenticate``), so authority gating is genuinely exercised.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from dining.models import DiningSession
from dining.services import find_device
from menu.models import MenuCategory, MenuItem
from ops.models import Order, RestaurantTable

pytestmark = pytest.mark.django_db

User = get_user_model()
VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# ── Fixtures / helpers ────────────────────────────────────────────────────────
def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _make_table(restaurant: Restaurant, code: str = "T1") -> RestaurantTable:
    return RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code=code, label=code
    )


def _make_item(restaurant: Restaurant, price_minor: int = 20000) -> MenuItem:
    category, _ = MenuCategory.objects.get_or_create(
        restaurant_id=restaurant.id, code="mains", defaults={"name": "Mains"}
    )
    return MenuItem.objects.create(
        restaurant_id=restaurant.id,
        category=category,
        code="burger",
        name="Burger",
        price_minor=price_minor,
        tax_rate_pct=5,
        available=True,
    )


def _staff_client(org: Organization, restaurant: Restaurant) -> APIClient:
    role, _ = Role.objects.get_or_create(
        org=org, key="server", defaults={"label": "Server"}
    )
    user = User.objects.create_user(email="s@x.com", password=VALID_PASSWORD)
    membership = Membership.objects.create(
        org=org, user=user, role=role, display_name="Server", email="s@x.com"
    )
    token = RefreshToken.for_user(user)
    token["restaurant_id"] = str(restaurant.id)
    token["org_id"] = str(org.id)
    token["membership_id"] = str(membership.id)
    token["perms"] = ["manage-floor"]
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def _join(restaurant: Restaurant, table: RestaurantTable) -> dict:
    client = APIClient()
    resp = client.post(
        "/api/dining/join/",
        {"restaurant_id": str(restaurant.id), "table_id": str(table.id)},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    return resp.data


def _set_mode(session_id, mode: str) -> None:
    DiningSession.all_objects.filter(pk=session_id).update(order_confirmation_mode=mode)


# ── Join / one-live-session-per-table ─────────────────────────────────────────
def test_two_scans_join_one_session() -> None:
    _org, restaurant = _make_tenant("a", "A1")
    table = _make_table(restaurant)

    first = _join(restaurant, table)
    second = _join(restaurant, table)

    assert first["session_id"] == second["session_id"]
    assert first["device_token"] != second["device_token"]
    session = DiningSession.all_objects.get(pk=first["session_id"])
    assert session.party_size == 2
    assert (
        DiningSession.all_objects.filter(
            table_id=table.id, status__in=["open", "ordering", "bill_requested"]
        ).count()
        == 1
    )


def test_join_unknown_table_rejected() -> None:
    _org, restaurant = _make_tenant("b", "B1")
    client = APIClient()
    import uuid

    resp = client.post(
        "/api/dining/join/",
        {"restaurant_id": str(restaurant.id), "table_id": str(uuid.uuid4())},
        format="json",
    )
    assert resp.status_code == 400


# ── waiter_confirm ────────────────────────────────────────────────────────────
def test_waiter_confirm_order_pends_then_staff_fires() -> None:
    org, restaurant = _make_tenant("c", "C1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "waiter_confirm")

    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 2}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 201, resp.content
    order = Order.all_objects.get(session_id=joined["session_id"])
    assert order.confirmation == "pending_confirmation"
    assert order.source == "guest"
    assert order.total_minor == 2 * 20000 + (20000 * 2 * 5 // 100)

    staff = _staff_client(org, restaurant)
    fired = staff.post(
        f"/api/dining/sessions/{joined['session_id']}/confirm/",
        {"order_ids": [str(order.id)]},
        format="json",
    )
    assert fired.status_code == 200, fired.content
    order.refresh_from_db()
    assert order.confirmation == "confirmed"


# ── leader mode (the owner's waiter-anoints flow) ─────────────────────────────
def test_leader_mode_blocks_non_leader_then_allows_after_promote() -> None:
    org, restaurant = _make_tenant("d", "D1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "leader")

    guest = APIClient()
    blocked = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert blocked.status_code == 403  # server-enforced, not just hidden in UI

    staff = _staff_client(org, restaurant)
    promoted = staff.post(
        f"/api/dining/sessions/{joined['session_id']}/promote/",
        {"device_token": joined["device_token"]},
        format="json",
    )
    assert promoted.status_code == 200, promoted.content

    allowed = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert allowed.status_code == 201, allowed.content
    order = Order.all_objects.get(session_id=joined["session_id"])
    assert order.confirmation == "confirmed"


def test_leader_mode_second_participant_cannot_order() -> None:
    org, restaurant = _make_tenant("e", "E1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    leader = _join(restaurant, table)
    bystander = _join(restaurant, table)
    _set_mode(leader["session_id"], "leader")

    staff = _staff_client(org, restaurant)
    staff.post(
        f"/api/dining/sessions/{leader['session_id']}/promote/",
        {"device_token": leader["device_token"]},
        format="json",
    )

    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{bystander['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=bystander["device_token"],
    )
    assert resp.status_code == 403


# ── auto_fire ─────────────────────────────────────────────────────────────────
def test_auto_fire_confirms_immediately() -> None:
    _org, restaurant = _make_tenant("f", "F1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "auto_fire")

    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 201, resp.content
    order = Order.all_objects.get(session_id=joined["session_id"])
    assert order.confirmation == "confirmed"


# ── staff floor cockpit ───────────────────────────────────────────────────────
def test_staff_lists_live_sessions() -> None:
    org, restaurant = _make_tenant("sl", "SL1")
    table = _make_table(restaurant)
    joined = _join(restaurant, table)

    staff = _staff_client(org, restaurant)
    resp = staff.get("/api/dining/sessions/")
    assert resp.status_code == 200, resp.content
    results = resp.data["results"]
    assert len(results) == 1
    assert results[0]["id"] == joined["session_id"]
    assert results[0]["table_code"] == "T1"


def test_session_list_requires_staff() -> None:
    _org, restaurant = _make_tenant("sl2", "SL2")
    table = _make_table(restaurant)
    _join(restaurant, table)
    # No JWT → rejected (no tenant bound).
    assert APIClient().get("/api/dining/sessions/").status_code in (401, 403)


# ── availability ──────────────────────────────────────────────────────────────
def test_sold_out_item_is_rejected() -> None:
    _org, restaurant = _make_tenant("so", "SO1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    item.sold_out = True
    item.save(update_fields=["sold_out"])
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "auto_fire")

    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 400  # server enforces sold_out, not just the UI


# ── epoch / turnover guard ────────────────────────────────────────────────────
def test_turnover_increments_epoch_and_kills_stale_token() -> None:
    org, restaurant = _make_tenant("g", "G1")
    table = _make_table(restaurant)
    first = _join(restaurant, table)

    staff = _staff_client(org, restaurant)
    closed = staff.post(
        f"/api/dining/sessions/{first['session_id']}/close/", {}, format="json"
    )
    assert closed.status_code == 200, closed.content

    # New party scans the same printed QR → brand-new session, epoch bumped.
    second = _join(restaurant, table)
    assert second["session_id"] != first["session_id"]
    assert second["epoch"] == first["epoch"] + 1

    # The previous party's device token must no longer authorize anything on the
    # new session (it belongs to the closed epoch).
    guest = APIClient()
    stale = guest.get(
        f"/api/dining/sessions/{second['session_id']}/",
        HTTP_X_DEVICE_TOKEN=first["device_token"],
    )
    # Rejected — 401 (no valid credentials) since the detail view also accepts a
    # staff JWT; the point is the stale epoch token authorizes nothing.
    assert stale.status_code in (401, 403)
    # And it genuinely does not resolve to a device in the new session.
    new_session = DiningSession.all_objects.get(pk=second["session_id"])
    assert find_device(new_session, first["device_token"]) is None


# ── snapshot contract (me / can_order — the frontend relies on these) ─────────
def test_session_snapshot_exposes_me_and_can_order() -> None:
    org, restaurant = _make_tenant("i", "I1")
    table = _make_table(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "leader")

    guest = APIClient()
    url = f"/api/dining/sessions/{joined['session_id']}/"

    before = guest.get(url, HTTP_X_DEVICE_TOKEN=joined["device_token"])
    assert before.status_code == 200, before.content
    assert before.data["me"]["role"] == "participant"
    assert before.data["can_order"] is False  # not yet the leader

    staff = _staff_client(org, restaurant)
    staff.post(
        f"/api/dining/sessions/{joined['session_id']}/promote/",
        {"device_token": joined["device_token"]},
        format="json",
    )

    after = guest.get(url, HTTP_X_DEVICE_TOKEN=joined["device_token"])
    assert after.data["me"]["role"] == "leader"
    assert after.data["can_order"] is True


# ── service requests (call waiter / water / bill) ─────────────────────────────
def test_guest_service_request_then_staff_claims_and_resolves() -> None:
    org, restaurant = _make_tenant("sr", "SR1")
    table = _make_table(restaurant)
    joined = _join(restaurant, table)

    guest = APIClient()
    created = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/service-request/",
        {"kind": "waiter", "note": "need cutlery"},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert created.status_code == 201, created.content
    req_id = created.data["id"]
    assert created.data["kind"] == "waiter"
    assert created.data["status"] == "pending"

    staff = _staff_client(org, restaurant)
    listed = staff.get("/api/dining/service-requests/")
    assert listed.status_code == 200, listed.content
    assert any(r["id"] == req_id for r in listed.data["results"])

    claimed = staff.post(f"/api/dining/service-requests/{req_id}/claim/")
    assert claimed.status_code == 200, claimed.content
    assert claimed.data["status"] == "claimed"

    resolved = staff.post(f"/api/dining/service-requests/{req_id}/resolve/")
    assert resolved.status_code == 200
    assert resolved.data["status"] == "resolved"
    # Resolved requests drop off the open queue.
    assert all(r["id"] != req_id for r in staff.get("/api/dining/service-requests/").data["results"])


def test_duplicate_pending_service_request_is_collapsed() -> None:
    _org, restaurant = _make_tenant("sr2", "SR2")
    table = _make_table(restaurant)
    joined = _join(restaurant, table)
    guest = APIClient()
    url = f"/api/dining/sessions/{joined['session_id']}/service-request/"
    a = guest.post(url, {"kind": "water"}, format="json", HTTP_X_DEVICE_TOKEN=joined["device_token"])
    b = guest.post(url, {"kind": "water"}, format="json", HTTP_X_DEVICE_TOKEN=joined["device_token"])
    assert a.data["id"] == b.data["id"]


# ── CRM linkage: contact capture backfills the order's customer ───────────────
def test_contact_capture_links_existing_orders_to_customer() -> None:
    _org, restaurant = _make_tenant("crm", "CRM1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "auto_fire")

    guest = APIClient()
    guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    order = Order.all_objects.get(session_id=joined["session_id"])
    assert order.customer_id is None  # anonymous at creation

    contact = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/contact/",
        {"phone": "+919812345678", "name": "Asha"},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert contact.status_code == 200, contact.content
    order.refresh_from_db()
    assert order.customer_id is not None  # backfilled to the enrolled customer


# ── idempotency ───────────────────────────────────────────────────────────────
def test_idempotent_submit_yields_one_order() -> None:
    _org, restaurant = _make_tenant("h", "H1")
    table = _make_table(restaurant)
    item = _make_item(restaurant)
    joined = _join(restaurant, table)
    _set_mode(joined["session_id"], "auto_fire")

    guest = APIClient()
    body = {"lines": [{"menu_item_id": str(item.id), "qty": 1}]}
    url = f"/api/dining/sessions/{joined['session_id']}/orders/"
    first = guest.post(url, body, format="json",
                       HTTP_X_DEVICE_TOKEN=joined["device_token"],
                       HTTP_IDEMPOTENCY_KEY="abc-123")
    second = guest.post(url, body, format="json",
                        HTTP_X_DEVICE_TOKEN=joined["device_token"],
                        HTTP_IDEMPOTENCY_KEY="abc-123")
    assert first.status_code == 201
    assert second.status_code == 201
    assert Order.all_objects.filter(session_id=joined["session_id"]).count() == 1
