"""Orders-slice tests: server-side pricing, tenancy, governance + audit, status.

Auth runs end to end through the JWT: tokens carry ``restaurant_id`` / ``org_id``
/ ``membership_id`` / ``perms`` claims and ``common.middleware.TenantMiddleware``
binds the active tenant + permission set from the ``Authorization`` header — so
scoping and permission gating are genuinely exercised (no ``force_authenticate``).

The load-bearing assertion is that **prices are server-derived**: a client that
posts a ``total`` (or per-line ``price``) has it ignored; the order total is
recomputed from the authoritative ``MenuItem`` / ``Modifier`` rows.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from menu.models import MenuCategory, MenuItem, Modifier, ModifierGroup
from ops.models import AuditLog, Order

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# --- Fixtures / helpers ------------------------------------------------------


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _make_membership(org: Organization, email: str) -> Membership:
    role, _ = Role.objects.get_or_create(
        org=org, key="server", defaults={"label": "Server"}
    )
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    return Membership.objects.create(
        org=org, user=user, role=role, display_name="Staffer", email=email
    )


def _auth_client(
    org: Organization,
    restaurant: Restaurant,
    membership: Membership,
    *,
    perms: list[str],
) -> APIClient:
    """Return an APIClient authenticated as ``membership`` of ``restaurant``."""
    token = RefreshToken.for_user(membership.user)
    token["restaurant_id"] = str(restaurant.id)
    token["org_id"] = str(org.id)
    token["membership_id"] = str(membership.id)
    token["perms"] = perms
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def _make_menu_item(
    restaurant: Restaurant,
    *,
    code: str = "burger",
    name: str = "Burger",
    price_minor: int = 20000,
    tax_rate_pct: int = 5,
    available: bool = True,
) -> MenuItem:
    category, _ = MenuCategory.objects.get_or_create(
        restaurant_id=restaurant.id, code="mains", defaults={"name": "Mains"}
    )
    return MenuItem.objects.create(
        restaurant_id=restaurant.id,
        category=category,
        code=code,
        name=name,
        price_minor=price_minor,
        tax_rate_pct=tax_rate_pct,
        available=available,
    )


def _make_modifier(
    restaurant: Restaurant, *, label: str = "Extra Cheese", delta: int = 5000
) -> Modifier:
    group = ModifierGroup.objects.create(restaurant_id=restaurant.id, name="Add-ons")
    return Modifier.objects.create(
        restaurant_id=restaurant.id, group=group, label=label, price_delta_minor=delta
    )


@pytest.fixture
def tenant_a():
    return _make_tenant("ord-a", "ORDA")


@pytest.fixture
def waiter_client(tenant_a):
    org, restaurant = tenant_a
    membership = _make_membership(org, "waiter@relish.test")
    return _auth_client(org, restaurant, membership, perms=[])


# --- Server-side pricing -----------------------------------------------------


@patch("ops.order_views.broadcast_order_event")
def test_pricing_is_server_derived_and_client_total_ignored(
    mock_broadcast, waiter_client, tenant_a
):
    _org, restaurant = tenant_a
    item = _make_menu_item(restaurant, price_minor=20000, tax_rate_pct=5)
    modifier = _make_modifier(restaurant, delta=5000)

    resp = waiter_client.post(
        "/api/ops/orders/",
        {
            # A malicious/buggy client tries to dictate the price + total.
            "total": 1,
            "lines": [
                {
                    "menu_item_id": str(item.id),
                    "qty": 2,
                    "modifier_ids": [str(modifier.id)],
                    "price": 1,
                }
            ],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data

    # 2 × (20000 + 5000) = 50000 subtotal; tax = 20000*2*5/100 = 2000.
    assert resp.data["subtotal_minor"] == 50000
    assert resp.data["tax_minor"] == 2000
    assert resp.data["total_minor"] == 52000
    # The client-sent total of 1 was ignored.
    assert resp.data["total_minor"] != 1

    line = resp.data["lines"][0]
    assert line["unit_price_minor"] == 20000
    assert line["qty"] == 2
    assert line["modifiers"][0]["price_delta_minor"] == 5000

    mock_broadcast.assert_called_once()
    order = Order.objects.get(id=resp.data["id"])
    assert order.total_minor == 52000


@patch("ops.order_views.broadcast_order_event")
def test_order_code_is_sequential_per_restaurant(
    mock_broadcast, waiter_client, tenant_a
):
    _org, restaurant = tenant_a
    item = _make_menu_item(restaurant)

    codes = []
    for _ in range(2):
        resp = waiter_client.post(
            "/api/ops/orders/",
            {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        codes.append(resp.data["code"])

    assert codes == ["ORD-00001", "ORD-00002"]


# --- Cross-tenant isolation --------------------------------------------------


@patch("ops.order_views.broadcast_order_event")
def test_cannot_order_other_restaurants_menu_item(
    mock_broadcast, waiter_client, tenant_a
):
    _org_a, _restaurant_a = tenant_a
    _org_b, restaurant_b = _make_tenant("ord-b", "ORDB")
    foreign_item = _make_menu_item(restaurant_b, code="alien", name="Alien Dish")

    resp = waiter_client.post(
        "/api/ops/orders/",
        {"lines": [{"menu_item_id": str(foreign_item.id), "qty": 1}]},
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert Order.objects.count() == 0
    mock_broadcast.assert_not_called()


@patch("ops.order_views.broadcast_order_event")
def test_unavailable_item_is_rejected(mock_broadcast, waiter_client, tenant_a):
    _org, restaurant = tenant_a
    item = _make_menu_item(restaurant, available=False)

    resp = waiter_client.post(
        "/api/ops/orders/",
        {"lines": [{"menu_item_id": str(item.id), "qty": 1}]},
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert Order.objects.count() == 0


# --- Governance: permission gating + audit trail -----------------------------


def _place_order_directly(restaurant: Restaurant, item: MenuItem) -> Order:
    """Place an order via the service, bypassing HTTP, for governance setups."""
    from common.context import reset_current_tenant, set_current_tenant
    from ops.services import place_order

    token = set_current_tenant(restaurant.id, restaurant.org_id)
    try:
        return place_order(
            restaurant_id=restaurant.id,
            lines=[{"menu_item_id": item.id, "qty": 1}],
        )
    finally:
        reset_current_tenant(token)


@patch("ops.order_views.broadcast_order_event")
def test_void_requires_permission_and_writes_audit(
    mock_broadcast, tenant_a
):
    org, restaurant = tenant_a
    item = _make_menu_item(restaurant)
    order = _place_order_directly(restaurant, item)

    membership = _make_membership(org, "voider@relish.test")

    # Without the "void" permission → 403, no audit, no mutation.
    no_perm = _auth_client(org, restaurant, membership, perms=[])
    denied = no_perm.post(f"/api/ops/orders/{order.id}/void/", {}, format="json")
    assert denied.status_code == 403
    order.refresh_from_db()
    assert order.voided is False
    assert AuditLog.objects.filter(type="void").count() == 0

    # With the "void" permission → 200, voided, audit row present.
    granted = _auth_client(org, restaurant, membership, perms=["void"])
    ok = granted.post(
        f"/api/ops/orders/{order.id}/void/",
        {"reason": "spilled"},
        format="json",
    )
    assert ok.status_code == 200, ok.data
    assert ok.data["voided"] is True
    order.refresh_from_db()
    assert order.voided is True

    audit = AuditLog.objects.get(type="void", order=order)
    assert str(audit.actor_membership_id) == str(membership.id)
    assert audit.reason == "spilled"
    assert audit.before["voided"] is False
    assert audit.after["voided"] is True
    mock_broadcast.assert_called_once()


@patch("ops.order_views.broadcast_order_event")
def test_comp_requires_permission_and_zeroes_total(mock_broadcast, tenant_a):
    org, restaurant = tenant_a
    item = _make_menu_item(restaurant, price_minor=20000)
    order = _place_order_directly(restaurant, item)
    membership = _make_membership(org, "comper@relish.test")

    denied = _auth_client(org, restaurant, membership, perms=[]).post(
        f"/api/ops/orders/{order.id}/comp/", {}, format="json"
    )
    assert denied.status_code == 403

    ok = _auth_client(org, restaurant, membership, perms=["comp"]).post(
        f"/api/ops/orders/{order.id}/comp/", {"reason": "VIP"}, format="json"
    )
    assert ok.status_code == 200, ok.data
    assert ok.data["comp"] is True
    assert ok.data["total_minor"] == 0

    audit = AuditLog.objects.get(type="comp", order=order)
    assert audit.amount_minor == 21000  # 20000 + 5% tax = 21000 comped.
    assert audit.before["comp"] is False
    assert audit.after["comp"] is True


@patch("ops.order_views.broadcast_order_event")
def test_discount_requires_permission_and_recomputes_total(
    mock_broadcast, tenant_a
):
    org, restaurant = tenant_a
    item = _make_menu_item(restaurant, price_minor=20000)  # total 21000 w/ tax.
    order = _place_order_directly(restaurant, item)
    membership = _make_membership(org, "discounter@relish.test")

    denied = _auth_client(org, restaurant, membership, perms=[]).post(
        f"/api/ops/orders/{order.id}/discount/",
        {"discount_pct": 10},
        format="json",
    )
    assert denied.status_code == 403

    ok = _auth_client(org, restaurant, membership, perms=["discount"]).post(
        f"/api/ops/orders/{order.id}/discount/",
        {"discount_pct": 10, "reason": "loyalty"},
        format="json",
    )
    assert ok.status_code == 200, ok.data
    assert ok.data["discount_pct"] == 10
    # 21000 - 10% = 18900.
    assert ok.data["total_minor"] == 18900

    audit = AuditLog.objects.get(type="discount", order=order)
    assert audit.amount_minor == 2100  # discount value applied.
    assert audit.after["discount_pct"] == 10


# --- Status flow + optimistic concurrency ------------------------------------


@patch("ops.order_views.broadcast_order_event")
def test_status_patch_bumps_version_and_broadcasts(
    mock_broadcast, waiter_client, tenant_a
):
    _org, restaurant = tenant_a
    item = _make_menu_item(restaurant)
    order = _place_order_directly(restaurant, item)
    assert order.status == "new"
    assert order.version == 1

    resp = waiter_client.patch(
        f"/api/ops/orders/{order.id}/status/",
        {"status": "preparing", "version": 1},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "preparing"
    assert resp.data["version"] == 2

    order.refresh_from_db()
    assert order.status == "preparing"
    assert order.version == 2
    mock_broadcast.assert_called_once()


@patch("ops.order_views.broadcast_order_event")
def test_status_patch_with_stale_version_returns_409(
    mock_broadcast, waiter_client, tenant_a
):
    _org, restaurant = tenant_a
    item = _make_menu_item(restaurant)
    order = _place_order_directly(restaurant, item)

    resp = waiter_client.patch(
        f"/api/ops/orders/{order.id}/status/",
        {"status": "ready", "version": 99},
        format="json",
    )
    assert resp.status_code == 409
    order.refresh_from_db()
    assert order.status == "new"
    mock_broadcast.assert_not_called()
