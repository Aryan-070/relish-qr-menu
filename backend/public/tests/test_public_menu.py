"""Tests for the public, unauthenticated guest-menu endpoint.

Covers the anonymous happy path, the safe-field allowlist, the publish/paid
gate (unpublished + suspended subscription), unknown ids, cross-tenant
isolation, and cache behavior.
"""
from __future__ import annotations

import uuid

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from accounts.models import Organization, Restaurant
from billing.models import Subscription
from menu.models import MenuCategory, MenuItem, Modifier, ModifierGroup


@pytest.fixture(autouse=True)
def _clear_cache():
    """Ensure each test starts (and ends) with an empty menu cache."""
    cache.clear()
    yield
    cache.clear()


def _make_org(name: str = "Acme Hospitality") -> Organization:
    suffix = uuid.uuid4().hex[:8]
    return Organization.objects.create(name=name, slug=f"acme-{suffix}")


def _make_restaurant(
    org: Organization,
    *,
    published: bool = True,
    active: bool = True,
    deleted: bool = False,
    code: str = "MAIN",
) -> Restaurant:
    return Restaurant.objects.create(
        org=org,
        name="Relish Downtown",
        code=code,
        published=published,
        active=active,
        deleted_at=timezone.now() if deleted else None,
    )


def _make_subscription(org_id: uuid.UUID, status: str = Subscription.Status.ACTIVE):
    return Subscription.objects.create(
        org_id=org_id,
        package=Subscription.Package.CLASSIC,
        status=status,
        renewal_at=timezone.now() + timezone.timedelta(days=365),
    )


def _make_category(restaurant_id: uuid.UUID, *, code="starters", name="Starters", sort=0):
    return MenuCategory.all_objects.create(
        restaurant_id=restaurant_id,
        code=code,
        name=name,
        sort_order=sort,
    )


def _make_item(
    restaurant_id: uuid.UUID,
    category: MenuCategory,
    *,
    code: str,
    name: str,
    available: bool = True,
    sold_out: bool = False,
    price_minor: int = 25000,
) -> MenuItem:
    return MenuItem.all_objects.create(
        restaurant_id=restaurant_id,
        category=category,
        code=code,
        name=name,
        price_minor=price_minor,
        available=available,
        sold_out=sold_out,
    )


def _menu_url(restaurant_id) -> str:
    return reverse("public:public_menu", kwargs={"restaurant_id": restaurant_id})


@pytest.fixture()
def public_restaurant(db):
    """A published, paid restaurant with one available + one hidden item."""
    org = _make_org()
    restaurant = _make_restaurant(org)
    _make_subscription(org.id)

    category = _make_category(restaurant.id, code="mains", name="Mains", sort=1)
    available = _make_item(
        restaurant.id, category, code="butter-paneer", name="Butter Paneer"
    )
    # An unavailable item and a sold-out one — neither category nor payload
    # should surface the unavailable one. (sold_out items are still available.)
    _make_item(
        restaurant.id,
        category,
        code="hidden-dish",
        name="Hidden Dish",
        available=False,
    )

    group = ModifierGroup.all_objects.create(
        restaurant_id=restaurant.id, name="Spice", min_select=1, max_select=1
    )
    group.items.add(available)
    Modifier.all_objects.create(
        restaurant_id=restaurant.id, group=group, label="Extra hot", price_delta_minor=0
    )

    return restaurant


@pytest.mark.django_db
def test_anonymous_get_returns_available_menu(api_client, public_restaurant):
    resp = api_client.get(_menu_url(public_restaurant.id))

    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True

    # Theme is present.
    assert "theme" in body
    assert isinstance(body["theme"], dict)

    # Restaurant identity is present and minimal.
    assert body["restaurant"]["name"] == "Relish Downtown"
    assert set(body["restaurant"].keys()) == {"id", "name"}

    # Exactly one category with exactly one (available) item.
    assert len(body["categories"]) == 1
    category = body["categories"][0]
    assert category["name"] == "Mains"
    item_names = [i["name"] for i in category["items"]]
    assert item_names == ["Butter Paneer"]
    assert "Hidden Dish" not in item_names

    # Modifier data round-trips.
    item = category["items"][0]
    assert item["modifier_groups"][0]["name"] == "Spice"
    assert item["modifier_groups"][0]["modifiers"][0]["label"] == "Extra hot"


@pytest.mark.django_db
def test_no_auth_header_required(api_client, public_restaurant):
    # APIClient with no credentials() call — fully anonymous.
    resp = api_client.get(_menu_url(public_restaurant.id))
    assert resp.status_code == 200
    assert resp.json()["available"] is True


@pytest.mark.django_db
def test_item_payload_excludes_internal_fields(api_client, public_restaurant):
    resp = api_client.get(_menu_url(public_restaurant.id))
    item = resp.json()["categories"][0]["items"][0]

    # Sensitive / internal fields must never leak.
    for forbidden in (
        "version",
        "restaurant_id",
        "deleted_at",
        "created_at",
        "updated_at",
        "tax_rate_pct",
    ):
        assert forbidden not in item, f"leaked internal field: {forbidden}"

    # Safe fields ARE present. `code` is an intentional public SKU the guest
    # client maps cart lines by (it is not sensitive — unlike cost/tax/version).
    for expected in ("id", "code", "name", "price_minor", "is_jain", "modifier_groups"):
        assert expected in item


@pytest.mark.django_db
def test_unpublished_restaurant_is_unavailable(api_client, db):
    org = _make_org()
    restaurant = _make_restaurant(org, published=False)
    _make_subscription(org.id)

    resp = api_client.get(_menu_url(restaurant.id))
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"available": False}
    assert "categories" not in body


@pytest.mark.django_db
def test_suspended_subscription_is_unavailable(api_client, db):
    org = _make_org()
    restaurant = _make_restaurant(org)
    _make_subscription(org.id, status=Subscription.Status.SUSPENDED)

    category = _make_category(restaurant.id)
    _make_item(restaurant.id, category, code="x", name="X")

    resp = api_client.get(_menu_url(restaurant.id))
    assert resp.status_code == 200
    assert resp.json() == {"available": False}


@pytest.mark.django_db
def test_unknown_restaurant_returns_404(api_client, db):
    resp = api_client.get(_menu_url(uuid.uuid4()))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_cross_tenant_items_are_isolated(api_client, public_restaurant):
    # A second, fully public restaurant with its own item.
    other_org = _make_org("Other Org")
    other = _make_restaurant(other_org, code="OTHER")
    _make_subscription(other_org.id)
    other_cat = _make_category(other.id, code="o", name="OtherCat")
    _make_item(other.id, other_cat, code="secret", name="Secret Dish")

    resp = api_client.get(_menu_url(public_restaurant.id))
    body = resp.json()

    all_item_names = [
        i["name"] for c in body["categories"] for i in c["items"]
    ]
    assert "Secret Dish" not in all_item_names
    all_category_names = [c["name"] for c in body["categories"]]
    assert "OtherCat" not in all_category_names


@pytest.mark.django_db
def test_second_request_served_from_cache(api_client, public_restaurant):
    # Warm the cache.
    first = api_client.get(_menu_url(public_restaurant.id))
    assert first.status_code == 200
    assert len(first.json()["categories"][0]["items"]) == 1

    # Delete all menu rows from the DB. If the second response still has the
    # item, it must have come from cache rather than the database.
    MenuItem.all_objects.all().delete()
    MenuCategory.all_objects.all().delete()

    second = api_client.get(_menu_url(public_restaurant.id))
    assert second.status_code == 200
    body = second.json()
    assert body["available"] is True
    assert body["categories"][0]["items"][0]["name"] == "Butter Paneer"


@pytest.mark.django_db
def test_second_request_issues_no_menu_queries(api_client, public_restaurant):
    api_client.get(_menu_url(public_restaurant.id))  # warm cache

    with CaptureQueriesContext(connection) as ctx:
        resp = api_client.get(_menu_url(public_restaurant.id))

    assert resp.status_code == 200
    menu_queries = [
        q["sql"]
        for q in ctx.captured_queries
        if "menu_menuitem" in q["sql"] or "menu_menucategory" in q["sql"]
    ]
    assert menu_queries == [], f"expected 0 menu queries on cache hit, got: {menu_queries}"
