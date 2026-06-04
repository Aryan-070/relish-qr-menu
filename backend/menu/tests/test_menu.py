"""Menu console CRUD tests: tenancy isolation, RBAC, concurrency, soft-delete.

Auth is exercised end to end through the JWT: tokens carry ``restaurant_id`` /
``org_id`` / ``perms`` claims, and ``common.middleware.TenantMiddleware`` decodes
the ``Authorization: Bearer`` header to bind the active tenant + permission set.
We therefore set credentials with a real signed token (not ``force_authenticate``)
so the middleware runs and scoping is genuinely tested.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Organization, Restaurant
from menu.models import MenuCategory, MenuItem

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
    token["perms"] = perms
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def tenant_a():
    return _make_tenant("org-a", "AAA")


@pytest.fixture
def editor_client(tenant_a):
    org, restaurant = tenant_a
    return _auth_client(
        org, restaurant, email="editor@relish.test", perms=["edit-menu"]
    )


# --- Create + RBAC -----------------------------------------------------------


def test_editor_can_create_category_and_item(editor_client, tenant_a):
    _org, restaurant = tenant_a

    cat_resp = editor_client.post(
        "/api/menu/categories/",
        {"code": "starters", "name": "Starters", "sort_order": 1},
        format="json",
    )
    assert cat_resp.status_code == 201, cat_resp.data
    category_id = cat_resp.data["id"]

    item_resp = editor_client.post(
        "/api/menu/items/",
        {
            "category": category_id,
            "code": "samosa",
            "name": "Samosa",
            "price_minor": 6000,
        },
        format="json",
    )
    assert item_resp.status_code == 201, item_resp.data
    assert item_resp.data["version"] == 1

    item = MenuItem.all_objects.get(id=item_resp.data["id"])
    assert str(item.restaurant_id) == str(restaurant.id)


def test_member_without_edit_menu_cannot_create(tenant_a):
    org, restaurant = tenant_a
    viewer = _auth_client(
        org, restaurant, email="viewer@relish.test", perms=[]
    )
    resp = viewer.post(
        "/api/menu/categories/",
        {"code": "drinks", "name": "Drinks"},
        format="json",
    )
    assert resp.status_code == 403


def test_list_returns_only_callers_restaurant_items(editor_client, tenant_a):
    _org, restaurant = tenant_a
    category = MenuCategory.objects.create(
        restaurant_id=restaurant.id, code="mains", name="Mains"
    )
    MenuItem.objects.create(
        restaurant_id=restaurant.id, category=category, code="thali", name="Thali"
    )
    # A stray item belonging to a different restaurant must not leak in.
    other_restaurant_id = uuid.uuid4()
    other_category = MenuCategory.objects.create(
        restaurant_id=other_restaurant_id, code="mains", name="Mains"
    )
    MenuItem.objects.create(
        restaurant_id=other_restaurant_id,
        category=other_category,
        code="thali",
        name="Other Thali",
    )

    resp = editor_client.get("/api/menu/items/", format="json")
    assert resp.status_code == 200
    names = {row["name"] for row in resp.data["results"]}
    assert names == {"Thali"}


# --- Cross-tenant isolation --------------------------------------------------


def test_items_are_isolated_across_tenants(editor_client, tenant_a):
    _org_a, restaurant_a = tenant_a
    category = MenuCategory.objects.create(
        restaurant_id=restaurant_a.id, code="mains", name="Mains"
    )
    MenuItem.objects.create(
        restaurant_id=restaurant_a.id,
        category=category,
        code="paneer",
        name="Paneer Tikka",
    )

    # Restaurant A sees its item.
    resp_a = editor_client.get("/api/menu/items/", format="json")
    assert resp_a.status_code == 200
    assert {row["name"] for row in resp_a.data["results"]} == {"Paneer Tikka"}

    # A token scoped to restaurant B sees nothing of A's.
    org_b, restaurant_b = _make_tenant("org-b", "BBB")
    client_b = _auth_client(
        org_b, restaurant_b, email="b@relish.test", perms=["edit-menu"]
    )
    resp_b = client_b.get("/api/menu/items/", format="json")
    assert resp_b.status_code == 200
    assert resp_b.data["results"] == []


# --- Optimistic concurrency --------------------------------------------------


def test_update_with_stale_version_returns_409(editor_client, tenant_a):
    _org, restaurant = tenant_a
    category = MenuCategory.objects.create(
        restaurant_id=restaurant.id, code="mains", name="Mains"
    )
    item = MenuItem.objects.create(
        restaurant_id=restaurant.id, category=category, code="dosa", name="Dosa"
    )
    assert item.version == 1

    resp = editor_client.patch(
        f"/api/menu/items/{item.id}/",
        {"name": "Masala Dosa", "version": 99},
        format="json",
    )
    assert resp.status_code == 409
    item.refresh_from_db()
    assert item.name == "Dosa"
    assert item.version == 1


def test_update_with_correct_version_bumps_it(editor_client, tenant_a):
    _org, restaurant = tenant_a
    category = MenuCategory.objects.create(
        restaurant_id=restaurant.id, code="mains", name="Mains"
    )
    item = MenuItem.objects.create(
        restaurant_id=restaurant.id, category=category, code="dosa", name="Dosa"
    )

    resp = editor_client.patch(
        f"/api/menu/items/{item.id}/",
        {"name": "Masala Dosa", "version": 1},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["version"] == 2
    item.refresh_from_db()
    assert item.name == "Masala Dosa"
    assert item.version == 2


# --- Soft delete -------------------------------------------------------------


def test_destroy_soft_deletes_item(editor_client, tenant_a):
    _org, restaurant = tenant_a
    category = MenuCategory.objects.create(
        restaurant_id=restaurant.id, code="mains", name="Mains"
    )
    item = MenuItem.objects.create(
        restaurant_id=restaurant.id, category=category, code="idli", name="Idli"
    )

    resp = editor_client.delete(f"/api/menu/items/{item.id}/", format="json")
    assert resp.status_code == 204

    # Gone from the tenant-scoped list...
    list_resp = editor_client.get("/api/menu/items/", format="json")
    assert list_resp.status_code == 200
    assert item.id not in {uuid.UUID(row["id"]) for row in list_resp.data["results"]}

    # ...but the row survives with deleted_at stamped.
    archived = MenuItem.all_objects.get(id=item.id)
    assert archived.deleted_at is not None
