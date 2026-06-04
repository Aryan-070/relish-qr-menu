"""Phase 3 — table-bill (Check) payment & liability.

Exercises the reuse of the billing Razorpay plumbing end to end:
* `pay` creates a Razorpay order for the server-computed Check total (HTTP mocked);
* the shared billing webhook settles the matching Check idempotently via the
  `payment_event_applied` signal (replay applies once);
* staff cash-settle and dispute mutate the Check and append an AuditLog row.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from billing.models import PaymentEvent
from dining.models import Check, DiningSession
from menu.models import MenuCategory, MenuItem
from ops.models import AuditLog, RestaurantTable

pytestmark = pytest.mark.django_db

User = get_user_model()
VALID_PASSWORD = "Str0ng-Relish-Pass!42"
WEBHOOK_SECRET = "whsec_test_secret_value"


# ── Fixtures ──────────────────────────────────────────────────────────────────
def _tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _table(restaurant: Restaurant) -> RestaurantTable:
    return RestaurantTable.objects.create(restaurant_id=restaurant.id, code="T1", label="T1")


def _item(restaurant: Restaurant, price_minor: int = 20000) -> MenuItem:
    category, _ = MenuCategory.objects.get_or_create(
        restaurant_id=restaurant.id, code="mains", defaults={"name": "Mains"}
    )
    return MenuItem.objects.create(
        restaurant_id=restaurant.id, category=category, code="burger",
        name="Burger", price_minor=price_minor, tax_rate_pct=5, available=True,
    )


def _staff_client(org: Organization, restaurant: Restaurant) -> APIClient:
    role, _ = Role.objects.get_or_create(org=org, key="server", defaults={"label": "Server"})
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


def _session_with_order(restaurant: Restaurant) -> tuple[dict, Check]:
    """Join, switch to auto_fire, place one order so the Check has a total."""
    table = _table(restaurant)
    item = _item(restaurant)
    guest = APIClient()
    joined = guest.post(
        "/api/dining/join/",
        {"restaurant_id": str(restaurant.id), "table_id": str(table.id)},
        format="json",
    ).data
    DiningSession.all_objects.filter(pk=joined["session_id"]).update(
        order_confirmation_mode="auto_fire"
    )
    guest.post(
        f"/api/dining/sessions/{joined['session_id']}/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    check = Check.all_objects.get(session_id=joined["session_id"])
    return joined, check


def _webhook_body(receipt: str, entity_id: str = "pay_TEST123") -> dict:
    entity = {"id": entity_id, "receipt": receipt, "notes": {"invoiceId": receipt}}
    return {
        "event": "payment.captured",
        "payload": {"payment": {"entity": entity}, "order": {"entity": entity}},
    }


def _sign(raw: bytes) -> str:
    return hmac.new(WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


# ── Tests ─────────────────────────────────────────────────────────────────────
@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret")
@patch("billing.services.requests.post")
def test_pay_creates_razorpay_order_for_server_total(mock_post) -> None:
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {"id": "order_CHK_1", "amount": 21000}

    _org, restaurant = _tenant("p", "P1")
    joined, check = _session_with_order(restaurant)
    assert check.total_minor == 20000 + (20000 * 5 // 100)  # 21000

    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/pay/",
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 200, resp.content
    assert resp.data["order_id"] == "order_CHK_1"
    assert resp.data["amount_minor"] == 21000
    # The amount handed to Razorpay is the server total, never client-supplied.
    assert mock_post.call_args.kwargs["json"]["amount"] == 21000
    check.refresh_from_db()
    assert check.razorpay_order_id == "order_CHK_1"


def test_pay_with_unconfigured_razorpay_is_503() -> None:
    _org, restaurant = _tenant("q", "Q1")
    joined, _check = _session_with_order(restaurant)
    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/pay/",
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 503


@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_webhook_settles_check_idempotently(django_capture_on_commit_callbacks) -> None:
    # Settlement fires from a transaction.on_commit hook, so capture+run callbacks.
    _org, restaurant = _tenant("r", "R1")
    _joined, check = _session_with_order(restaurant)
    receipt = f"CHK-{check.id}"
    body = _webhook_body(receipt)
    raw = json.dumps(body).encode("utf-8")

    client = APIClient()
    with django_capture_on_commit_callbacks(execute=True):
        first = client.post(
            "/api/billing/webhook/", data=raw, content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=_sign(raw),
        )
    assert first.status_code == 200, first.content
    check.refresh_from_db()
    assert check.status == "settled"
    assert check.paid_minor == check.total_minor
    assert PaymentEvent.objects.count() == 1

    # Replay → idempotent: no second event, no second settlement.
    with django_capture_on_commit_callbacks(execute=True):
        second = client.post(
            "/api/billing/webhook/", data=raw, content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=_sign(raw),
        )
    assert second.status_code == 200
    assert PaymentEvent.objects.count() == 1


def test_staff_cash_settle_audits() -> None:
    org, restaurant = _tenant("s", "S1")
    joined, check = _session_with_order(restaurant)
    staff = _staff_client(org, restaurant)
    resp = staff.post(
        f"/api/dining/sessions/{joined['session_id']}/settle-cash/", {}, format="json"
    )
    assert resp.status_code == 200, resp.content
    check.refresh_from_db()
    assert check.status == "settled"
    assert check.paid_minor == check.total_minor
    assert AuditLog.objects.filter(restaurant_id=restaurant.id, type="payment").count() == 1


def test_staff_dispute_marks_check_and_audits() -> None:
    org, restaurant = _tenant("t", "T1")
    joined, check = _session_with_order(restaurant)
    staff = _staff_client(org, restaurant)
    resp = staff.post(
        f"/api/dining/sessions/{joined['session_id']}/dispute/",
        {"reason": "guest walked out"},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    check.refresh_from_db()
    assert check.status == "disputed"
    audit = AuditLog.objects.get(restaurant_id=restaurant.id, type="dispute")
    assert audit.reason == "guest walked out"


def test_double_cash_settle_is_rejected() -> None:
    org, restaurant = _tenant("v", "V1")
    joined, _check = _session_with_order(restaurant)
    staff = _staff_client(org, restaurant)
    url = f"/api/dining/sessions/{joined['session_id']}/settle-cash/"
    first = staff.post(url, {}, format="json")
    assert first.status_code == 200, first.content
    second = staff.post(url, {}, format="json")
    assert second.status_code == 400  # already settled
    # Exactly one payment audit row — no falsified double entry.
    assert AuditLog.objects.filter(restaurant_id=restaurant.id, type="payment").count() == 1


def test_cannot_pay_a_settled_bill() -> None:
    org, restaurant = _tenant("w", "W1")
    joined, _check = _session_with_order(restaurant)
    _staff_client(org, restaurant).post(
        f"/api/dining/sessions/{joined['session_id']}/settle-cash/", {}, format="json"
    )
    guest = APIClient()
    resp = guest.post(
        f"/api/dining/sessions/{joined['session_id']}/pay/",
        format="json",
        HTTP_X_DEVICE_TOKEN=joined["device_token"],
    )
    assert resp.status_code == 400  # nothing to pay — already settled


def test_guest_device_cannot_settle_or_dispute() -> None:
    """Settlement/dispute are staff-only — a guest device token is rejected."""
    _org, restaurant = _tenant("u", "U1")
    joined, _check = _session_with_order(restaurant)
    guest = APIClient()
    for action in ("settle-cash", "dispute"):
        resp = guest.post(
            f"/api/dining/sessions/{joined['session_id']}/{action}/",
            format="json",
            HTTP_X_DEVICE_TOKEN=joined["device_token"],
        )
        assert resp.status_code in (401, 403), f"{action}: {resp.status_code}"
