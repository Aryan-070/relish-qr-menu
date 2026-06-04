import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.constants import MEMBERSHIP_ACTIVE, ROLE_ADMIN
from accounts.models import (
    Membership,
    MembershipOutlet,
    Organization,
    Restaurant,
    Role,
    TenantShard,
)
from accounts.services.provisioning import provision_org

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(email="owner@relish.test", password=VALID_PASSWORD)


def _make_second_membership(user, org_name="Second Co", code="OUT-9"):
    """Build a second active admin membership (+ outlet) for ``user``."""
    org = Organization.objects.create(name=org_name, slug=org_name.lower().replace(" ", "-"))
    restaurant = Restaurant.objects.create(org=org, name=f"{org_name} Outlet", code=code)
    TenantShard.objects.create(restaurant=restaurant)
    admin_role = Role.objects.get(key=ROLE_ADMIN, org__isnull=True)
    membership = Membership.objects.create(
        org=org,
        user=user,
        role=admin_role,
        display_name=user.email,
        email=user.email,
        status=MEMBERSHIP_ACTIVE,
        active=True,
    )
    MembershipOutlet.objects.create(
        membership=membership, restaurant=restaurant, is_primary=True
    )
    return membership


# --- Provision endpoint -----------------------------------------------------


def test_provision_returns_token_with_tenancy_claims(api_client, user):
    api_client.force_authenticate(user=user)
    url = reverse("accounts:provision")
    resp = api_client.post(
        url,
        {"org_name": "Spice Route", "restaurant_name": "Spice Route Bandra", "city": "Mumbai"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data

    decoded = AccessToken(resp.data["access"])
    assert decoded["org_id"] is not None
    assert decoded["restaurant_id"] is not None
    assert decoded["role"] == ROLE_ADMIN
    assert "manage-staff" in decoded["perms"]
    assert decoded["membership_id"] == resp.data["membership"]["membership_id"]


def test_provision_is_idempotent_over_http(api_client, user):
    api_client.force_authenticate(user=user)
    url = reverse("accounts:provision")
    payload = {"org_name": "Spice Route", "restaurant_name": "Spice Route Bandra"}

    first = api_client.post(url, payload, format="json")
    second = api_client.post(
        url, {"org_name": "Other", "restaurant_name": "Other Outlet"}, format="json"
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert (
        first.data["membership"]["membership_id"]
        == second.data["membership"]["membership_id"]
    )
    assert Organization.objects.count() == 1


def test_provision_requires_authentication(api_client):
    url = reverse("accounts:provision")
    resp = api_client.post(
        url, {"org_name": "X", "restaurant_name": "Y"}, format="json"
    )
    assert resp.status_code == 401


def test_provision_validation_error_envelope(api_client, user):
    api_client.force_authenticate(user=user)
    url = reverse("accounts:provision")
    resp = api_client.post(url, {"restaurant_name": "No Org"}, format="json")
    assert resp.status_code == 400
    assert "org_name" in resp.data["detail"]


# --- Switch endpoint --------------------------------------------------------


def test_switch_returns_token_scoped_to_chosen_membership(api_client, user):
    first = provision_org(user, "Spice Route", "Spice Route Bandra")
    second = _make_second_membership(user)

    api_client.force_authenticate(user=user)
    url = reverse("accounts:tenant_switch")
    resp = api_client.post(url, {"membership_id": str(second.id)}, format="json")

    assert resp.status_code == 200
    decoded = AccessToken(resp.data["access"])
    assert decoded["membership_id"] == str(second.id)
    assert decoded["org_id"] == str(second.org_id)
    # Scoped to the second org, not the first.
    assert decoded["org_id"] != str(first.org_id)
    assert resp.data["membership"]["membership_id"] == str(second.id)


def test_switch_unknown_membership_returns_404(api_client, user):
    provision_org(user, "Spice Route", "Spice Route Bandra")
    api_client.force_authenticate(user=user)
    url = reverse("accounts:tenant_switch")
    resp = api_client.post(
        url,
        {"membership_id": "00000000-0000-0000-0000-000000000000"},
        format="json",
    )
    assert resp.status_code == 404


def test_switch_other_users_membership_returns_403(api_client, user):
    other = User.objects.create_user(email="other@relish.test", password=VALID_PASSWORD)
    other_membership = provision_org(other, "Their Org", "Their Outlet")

    api_client.force_authenticate(user=user)
    url = reverse("accounts:tenant_switch")
    resp = api_client.post(
        url, {"membership_id": str(other_membership.id)}, format="json"
    )
    assert resp.status_code == 403


# --- Me endpoint ------------------------------------------------------------


def test_me_returns_memberships_list(api_client, user):
    provision_org(user, "Spice Route", "Spice Route Bandra")
    _make_second_membership(user)

    api_client.force_authenticate(user=user)
    url = reverse("accounts:me")
    resp = api_client.get(url)

    assert resp.status_code == 200
    assert resp.data["email"] == user.email
    assert len(resp.data["memberships"]) == 2
    assert resp.data["active"] is not None
    assert resp.data["active"]["role"] == ROLE_ADMIN


def test_me_no_membership_has_empty_list(api_client, user):
    api_client.force_authenticate(user=user)
    url = reverse("accounts:me")
    resp = api_client.get(url)

    assert resp.status_code == 200
    assert resp.data["memberships"] == []
    assert resp.data["active"] is None
