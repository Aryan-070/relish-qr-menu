"""Customer-slice tests: org-scoped enrollment, phone dedupe, cross-org
isolation, and soft-delete.

Auth runs end to end through the JWT — tokens carry ``org_id`` /
``restaurant_id`` / ``membership_id`` claims and ``TenantMiddleware`` binds the
active org from the ``Authorization`` header, so org scoping is genuinely
exercised (no ``force_authenticate``). Customers are **org-scoped**: a guest is
shared across a chain's outlets, so the load-bearing assertion is that org B
cannot see org A's customers and that re-enrolling a phone returns the *same*
record rather than a duplicate.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from crm.models import Customer

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"

CUSTOMERS_URL = "/api/crm/customers/"


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _make_membership(org: Organization, email: str) -> Membership:
    role, _ = Role.objects.get_or_create(
        org=org, key="manager", defaults={"label": "Manager"}
    )
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    return Membership.objects.create(
        org=org, user=user, role=role, display_name="Manager", email=email
    )


def _auth_client(
    org: Organization, restaurant: Restaurant, membership: Membership
) -> APIClient:
    token = RefreshToken.for_user(membership.user)
    token["org_id"] = str(org.id)
    token["restaurant_id"] = str(restaurant.id)
    token["membership_id"] = str(membership.id)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def org_a():
    org, restaurant = _make_tenant("org-a", "A1")
    membership = _make_membership(org, "a@example.com")
    return org, restaurant, membership


@pytest.fixture
def org_b():
    org, restaurant = _make_tenant("org-b", "B1")
    membership = _make_membership(org, "b@example.com")
    return org, restaurant, membership


def test_enroll_by_phone_creates_org_scoped_customer(org_a):
    org, restaurant, membership = org_a
    client = _auth_client(org, restaurant, membership)

    resp = client.post(
        CUSTOMERS_URL, {"phone": "+919812345678", "name": "Asha"}, format="json"
    )

    assert resp.status_code == 201, resp.data
    assert resp.data["phone"] == "+919812345678"
    assert resp.data["name"] == "Asha"
    customer = Customer.objects.get(phone="+919812345678")
    assert str(customer.org_id) == str(org.id)


def test_enroll_same_phone_dedupes_to_same_customer(org_a):
    org, restaurant, membership = org_a
    client = _auth_client(org, restaurant, membership)

    first = client.post(
        CUSTOMERS_URL, {"phone": "+919800000000", "name": "Ravi"}, format="json"
    )
    assert first.status_code == 201, first.data

    second = client.post(
        CUSTOMERS_URL, {"phone": "+919800000000", "name": "Ignored"}, format="json"
    )

    assert second.status_code == 200, second.data
    assert second.data["id"] == first.data["id"]
    assert Customer.objects.filter(phone="+919800000000").count() == 1


def test_customers_isolated_across_orgs(org_a, org_b):
    org_a_obj, rest_a, mem_a = org_a
    org_b_obj, rest_b, mem_b = org_b

    client_a = _auth_client(org_a_obj, rest_a, mem_a)
    created = client_a.post(
        CUSTOMERS_URL, {"phone": "+919700000000", "name": "Private"}, format="json"
    )
    assert created.status_code == 201, created.data

    client_b = _auth_client(org_b_obj, rest_b, mem_b)
    listing = client_b.get(CUSTOMERS_URL)

    assert listing.status_code == 200, listing.data
    phones = [row["phone"] for row in listing.data["results"]]
    assert "+919700000000" not in phones
    assert listing.data["results"] == []


def test_soft_delete_hides_customer_from_list(org_a):
    org, restaurant, membership = org_a
    client = _auth_client(org, restaurant, membership)

    created = client.post(
        CUSTOMERS_URL, {"phone": "+919611111111", "name": "Gone"}, format="json"
    )
    assert created.status_code == 201, created.data
    customer_id = created.data["id"]

    delete = client.delete(f"{CUSTOMERS_URL}{customer_id}/")
    assert delete.status_code == 204, getattr(delete, "data", None)

    listing = client.get(CUSTOMERS_URL)
    assert listing.status_code == 200
    ids = [row["id"] for row in listing.data["results"]]
    assert customer_id not in ids

    # Soft-deleted: the row still exists, only ``deleted_at`` is set.
    customer = Customer.objects.get(id=customer_id)
    assert customer.deleted_at is not None
