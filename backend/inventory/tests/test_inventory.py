"""Inventory & procurement tests: RBAC, the stock ledger, low-stock, tenancy.

Auth is exercised end to end through the JWT: tokens carry ``restaurant_id`` /
``org_id`` / ``membership_id`` / ``perms`` claims, and
``common.middleware.TenantMiddleware`` decodes the ``Authorization: Bearer``
header to bind the active tenant + permission set. We therefore set credentials
with a real signed token (not ``force_authenticate``) so the middleware runs and
scoping is genuinely tested.

The core invariant under test: ``Ingredient.stock`` only ever changes via a
``StockMovement`` ledger row written by :mod:`inventory.services`; and every
write (create / update / delete plus ``receive`` / ``adjust`` / wastage) is
gated by the ``manage-stock`` permission.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Organization, Restaurant
from inventory.models import Ingredient, StockMovement, Supplier

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# --- Fixtures / helpers ------------------------------------------------------


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _auth_client(
    org: Organization,
    restaurant: Restaurant,
    *,
    email: str,
    perms: list[str],
) -> APIClient:
    """Return an APIClient authenticated as a member of ``restaurant``."""
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    token = RefreshToken.for_user(user)
    token["restaurant_id"] = str(restaurant.id)
    token["org_id"] = str(org.id)
    token["membership_id"] = str(uuid.uuid4())
    token["perms"] = perms
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def tenant_a():
    return _make_tenant("inv-org-a", "INVA")


@pytest.fixture
def manager_client(tenant_a):
    """A caller holding ``manage-stock``."""
    org, restaurant = tenant_a
    return _auth_client(
        org, restaurant, email="manager@relish.test", perms=["manage-stock"]
    )


def _make_ingredient(
    restaurant: Restaurant,
    *,
    name: str = "Tomato",
    stock: str = "0",
    low_threshold: str = "0",
) -> Ingredient:
    return Ingredient.objects.create(
        restaurant_id=restaurant.id,
        name=name,
        unit="kg",
        stock=Decimal(stock),
        low_threshold=Decimal(low_threshold),
    )


# --- Create + RBAC -----------------------------------------------------------


def test_manager_can_create_supplier_and_ingredient(manager_client, tenant_a):
    _org, restaurant = tenant_a

    supplier_resp = manager_client.post(
        "/api/inventory/suppliers/",
        {"name": "Fresh Farms", "phone": "9990001111"},
        format="json",
    )
    assert supplier_resp.status_code == 201, supplier_resp.data
    supplier_id = supplier_resp.data["id"]

    ing_resp = manager_client.post(
        "/api/inventory/ingredients/",
        {
            "name": "Onion",
            "unit": "kg",
            "stock": "5.000",
            "low_threshold": "2.000",
            "supplier": supplier_id,
        },
        format="json",
    )
    assert ing_resp.status_code == 201, ing_resp.data
    assert ing_resp.data["is_low"] is False

    ingredient = Ingredient.all_objects.get(id=ing_resp.data["id"])
    assert str(ingredient.restaurant_id) == str(restaurant.id)


def test_non_holder_cannot_create_supplier(tenant_a):
    org, restaurant = tenant_a
    viewer = _auth_client(
        org, restaurant, email="viewer@relish.test", perms=[]
    )
    resp = viewer.post(
        "/api/inventory/suppliers/",
        {"name": "Sneaky Supplier"},
        format="json",
    )
    assert resp.status_code == 403


# --- Receiving a purchase order moves stock through the ledger ---------------


def test_receive_purchase_order_increments_stock_via_ledger(
    manager_client, tenant_a
):
    _org, restaurant = tenant_a
    supplier = Supplier.objects.create(
        restaurant_id=restaurant.id, name="Bulk Co"
    )
    ingredient = _make_ingredient(restaurant, name="Flour", stock="0")

    po_resp = manager_client.post(
        "/api/inventory/purchase-orders/",
        {
            "supplier": str(supplier.id),
            "lines": [
                {"ingredient_id": str(ingredient.id), "qty": "10", "cost_minor": 5000}
            ],
        },
        format="json",
    )
    assert po_resp.status_code == 201, po_resp.data
    po_id = po_resp.data["id"]

    receive_resp = manager_client.post(
        f"/api/inventory/purchase-orders/{po_id}/receive/", {}, format="json"
    )
    assert receive_resp.status_code == 200, receive_resp.data
    assert receive_resp.data["status"] == "received"

    ingredient.refresh_from_db()
    assert ingredient.stock == Decimal("10.000")

    movements = StockMovement.all_objects.filter(
        ingredient=ingredient, reason="purchase"
    )
    assert movements.count() == 1
    assert movements.first().delta == Decimal("10.000")

    # Receiving a second time is rejected (already received).
    second = manager_client.post(
        f"/api/inventory/purchase-orders/{po_id}/receive/", {}, format="json"
    )
    assert second.status_code == 400, second.data


# --- Wastage depletes stock through the ledger ------------------------------


def test_wastage_decrements_stock_via_ledger(manager_client, tenant_a):
    _org, restaurant = tenant_a
    ingredient = _make_ingredient(restaurant, name="Milk", stock="8")

    resp = manager_client.post(
        "/api/inventory/wastage/",
        {"ingredient": str(ingredient.id), "qty": "3", "reason": "spoiled"},
        format="json",
    )
    assert resp.status_code == 201, resp.data

    ingredient.refresh_from_db()
    assert ingredient.stock == Decimal("5.000")

    movements = StockMovement.all_objects.filter(
        ingredient=ingredient, reason="wastage"
    )
    assert movements.count() == 1
    assert movements.first().delta == Decimal("-3.000")


# --- low_stock action --------------------------------------------------------


def test_low_stock_lists_only_ingredients_under_threshold(manager_client, tenant_a):
    _org, restaurant = tenant_a
    low = _make_ingredient(
        restaurant, name="Saffron", stock="1", low_threshold="5"
    )
    _make_ingredient(restaurant, name="Salt", stock="20", low_threshold="5")

    resp = manager_client.get("/api/inventory/ingredients/low_stock/")
    assert resp.status_code == 200, resp.data
    names = {row["name"] for row in resp.data["results"]}
    assert names == {"Saffron"}
    assert str(low.id) in {row["id"] for row in resp.data["results"]}


# --- Cross-tenant isolation --------------------------------------------------


def test_ingredients_are_tenant_isolated(manager_client, tenant_a):
    _org, restaurant = tenant_a
    _make_ingredient(restaurant, name="Basil", stock="3")

    # A stray ingredient belonging to a different restaurant must not leak in.
    other_restaurant_id = uuid.uuid4()
    Ingredient.objects.create(
        restaurant_id=other_restaurant_id,
        name="Other Basil",
        unit="kg",
        stock=Decimal("3"),
    )

    resp = manager_client.get("/api/inventory/ingredients/")
    assert resp.status_code == 200, resp.data
    names = {row["name"] for row in resp.data["results"]}
    assert names == {"Basil"}
