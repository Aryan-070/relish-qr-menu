"""Loyalty-slice tests: the append-only ledger is the source of truth.

Covers the welcome bonus, earning (with the tier bump at threshold), redeeming
(including the over-redeem guard surfaced as HTTP 400), and the cache-integrity
invariant — ``recompute_balance`` must equal the sum of the ledger deltas, i.e.
the cached ``Customer.points`` never drifts from the truth.

Auth runs end to end through the JWT so org scoping is genuinely exercised.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from crm import loyalty_services
from crm.loyalty_services import LoyaltyError
from crm.models import Customer, LoyaltyLedger

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
def tenant():
    org, restaurant = _make_tenant("loyal", "L1")
    membership = _make_membership(org, "loyal@example.com")
    return org, restaurant, membership


@pytest.fixture
def client(tenant):
    org, restaurant, membership = tenant
    return _auth_client(org, restaurant, membership)


def _enroll(client, phone: str, name: str = "") -> dict:
    resp = client.post(CUSTOMERS_URL, {"phone": phone, "name": name}, format="json")
    assert resp.status_code == 201, resp.data
    return resp.data


# --- Welcome bonus -----------------------------------------------------------


def test_enroll_grants_welcome_bonus(client):
    data = _enroll(client, "+919811111111", "Newbie")

    assert data["points"] == loyalty_services.WELCOME_BONUS_POINTS
    customer = Customer.objects.get(id=data["id"])
    ledger = customer.ledger.all()
    assert ledger.count() == 1
    assert ledger.first().points_delta == loyalty_services.WELCOME_BONUS_POINTS


# --- Earning + tier bump -----------------------------------------------------


def test_earn_adds_points_ledger_and_bumps_tier(client):
    data = _enroll(client, "+919822222222", "Spender")
    customer_id = data["id"]
    assert data["tier"] == "Bronze"

    # Welcome bonus is 50; earn 500 more → 550 ≥ 500 Silver threshold.
    resp = client.post(
        f"{CUSTOMERS_URL}{customer_id}/earn/", {"points": 500}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["points"] == loyalty_services.WELCOME_BONUS_POINTS + 500
    assert resp.data["tier"] == "Silver"

    customer = Customer.objects.get(id=customer_id)
    assert customer.ledger.count() == 2  # welcome + earn


def test_tier_for_thresholds():
    assert loyalty_services.tier_for(0) == "Bronze"
    assert loyalty_services.tier_for(499) == "Bronze"
    assert loyalty_services.tier_for(500) == "Silver"
    assert loyalty_services.tier_for(1999) == "Silver"
    assert loyalty_services.tier_for(2000) == "Gold"


# --- Redeeming + over-redeem guard -------------------------------------------


def test_redeem_decrements_balance(client):
    data = _enroll(client, "+919833333333", "Redeemer")
    customer_id = data["id"]
    client.post(f"{CUSTOMERS_URL}{customer_id}/earn/", {"points": 200}, format="json")

    resp = client.post(
        f"{CUSTOMERS_URL}{customer_id}/redeem/", {"points": 100}, format="json"
    )

    assert resp.status_code == 200, resp.data
    # 50 welcome + 200 earned - 100 redeemed = 150.
    assert resp.data["points"] == 150
    customer = Customer.objects.get(id=customer_id)
    assert customer.ledger.filter(reason="redeem").count() == 1


def test_over_redeem_is_rejected_400(client):
    data = _enroll(client, "+919844444444", "Greedy")
    customer_id = data["id"]  # only the 50-point welcome bonus

    resp = client.post(
        f"{CUSTOMERS_URL}{customer_id}/redeem/", {"points": 10000}, format="json"
    )

    assert resp.status_code == 400, resp.data
    assert resp.data["success"] is False
    customer = Customer.objects.get(id=customer_id)
    # Balance untouched; no redeem ledger row written.
    assert customer.points == loyalty_services.WELCOME_BONUS_POINTS
    assert customer.ledger.filter(reason="redeem").count() == 0


def test_redeem_service_raises_loyalty_error_on_insufficient_balance(tenant):
    org, _restaurant, _membership = tenant
    customer = Customer.objects.create(org_id=org.id, phone="+919855555555")
    loyalty_services.earn_points(customer, 30)

    with pytest.raises(LoyaltyError):
        loyalty_services.redeem_points(customer, 31)


# --- Cache integrity: cache == sum of ledger deltas --------------------------


def test_recompute_balance_equals_ledger_sum(client, tenant):
    data = _enroll(client, "+919866666666", "Auditee")
    customer_id = data["id"]
    client.post(f"{CUSTOMERS_URL}{customer_id}/earn/", {"points": 300}, format="json")
    client.post(f"{CUSTOMERS_URL}{customer_id}/redeem/", {"points": 80}, format="json")

    customer = Customer.objects.get(id=customer_id)
    ledger_sum = customer.ledger.aggregate(total=Sum("points_delta"))["total"]

    # Cache already matches the ledger truth after every mutation.
    assert customer.points == ledger_sum

    # And deliberately corrupting the cache is healed by recompute_balance.
    customer.points = 999999
    customer.save(update_fields=["points"])
    healed = loyalty_services.recompute_balance(customer)
    assert healed.points == ledger_sum
    assert LoyaltyLedger.objects.filter(customer=customer).aggregate(
        total=Sum("points_delta")
    )["total"] == healed.points
