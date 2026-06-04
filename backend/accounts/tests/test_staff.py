"""Tests for the staff-management slice (roster, invite, accept, perms, deactivate).

Orgs/memberships are built directly through the ORM. Manager tokens are minted
by hand (per the slice contract) so the tenancy middleware resolves the active
org from the ``org_id`` claim and ``HasPermission`` reads the ``perms`` claim.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.constants import (
    INVITE_PENDING,
    MEMBERSHIP_ACTIVE,
    MEMBERSHIP_INVITED,
    MEMBERSHIP_SUSPENDED,
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_WAITER,
)
from accounts.models import (
    Invite,
    Membership,
    Organization,
    Restaurant,
    Role,
)
from accounts.services.staff import (
    accept_invite,
    deactivate_membership,
    set_membership_permissions,
)

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# --- Fixtures ---------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def org():
    return Organization.objects.create(name="Relish Diner", slug="relish-diner")


@pytest.fixture
def outlet(org):
    return Restaurant.objects.create(org=org, name="Main", code="MAIN")


def _system_role(key: str) -> Role:
    return Role.objects.get(key=key, org__isnull=True)


@pytest.fixture
def manager_membership(org):
    user = User.objects.create_user(email="manager@relish.test", password=VALID_PASSWORD)
    return Membership.objects.create(
        org=org,
        user=user,
        role=_system_role(ROLE_MANAGER),
        display_name="Manager",
        email=user.email,
        status=MEMBERSHIP_ACTIVE,
    )


def _auth(client: APIClient, membership: Membership, perms: list[str]) -> None:
    """Mint a JWT carrying the membership's org + the given perms, and attach it."""
    token = RefreshToken.for_user(membership.user)
    token["org_id"] = str(membership.org_id)
    token["membership_id"] = str(membership.id)
    token["perms"] = perms
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")


# --- List + invite ----------------------------------------------------------


def test_manager_can_list_roster(api_client, org, manager_membership):
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.get(reverse("accounts:staff_list"))
    assert resp.status_code == 200
    emails = {row["email"] for row in resp.data}
    assert "manager@relish.test" in emails


def test_manager_can_invite_staff(api_client, org, manager_membership, outlet):
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:staff_list"),
        {"email": "cook@relish.test", "role_key": ROLE_WAITER, "outlet_ids": [str(outlet.id)]},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["token"]
    assert resp.data["status"] == INVITE_PENDING

    membership = Membership.objects.get(email="cook@relish.test", org=org)
    assert membership.status == MEMBERSHIP_INVITED
    assert membership.user is None
    assert membership.outlets.count() == 1
    assert membership.outlets.first().is_primary is True

    invite = Invite.objects.get(membership=membership)
    assert invite.status == INVITE_PENDING
    assert invite.token == resp.data["token"]


def test_invite_without_permission_is_forbidden(api_client, org, manager_membership):
    # Token carries no "manage-staff" perm.
    _auth(api_client, manager_membership, ["view-reports"])
    resp = api_client.post(
        reverse("accounts:staff_list"),
        {"email": "x@relish.test", "role_key": ROLE_WAITER},
        format="json",
    )
    assert resp.status_code == 403
    assert not Membership.objects.filter(email="x@relish.test").exists()


def test_invite_rejects_outlet_from_other_org(api_client, org, manager_membership):
    other_org = Organization.objects.create(name="Other", slug="other")
    foreign_outlet = Restaurant.objects.create(org=other_org, name="Foreign", code="F1")
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:staff_list"),
        {
            "email": "y@relish.test",
            "role_key": ROLE_WAITER,
            "outlet_ids": [str(foreign_outlet.id)],
        },
        format="json",
    )
    assert resp.status_code == 400
    # The transaction rolled back — no membership leaked.
    assert not Membership.objects.filter(email="y@relish.test").exists()


# --- Accept invite ----------------------------------------------------------


def test_accept_invite_binds_user_and_activates(api_client, org, manager_membership):
    _auth(api_client, manager_membership, ["manage-staff"])
    invite_resp = api_client.post(
        reverse("accounts:staff_list"),
        {"email": "newhire@relish.test", "role_key": ROLE_WAITER},
        format="json",
    )
    token = invite_resp.data["token"]

    # Public endpoint — drop credentials to prove it needs none.
    api_client.credentials()
    resp = api_client.post(
        reverse("accounts:accept_invite"),
        {"token": token, "password": VALID_PASSWORD},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["status"] == MEMBERSHIP_ACTIVE

    membership = Membership.objects.get(email="newhire@relish.test")
    assert membership.status == MEMBERSHIP_ACTIVE
    assert membership.user is not None
    assert membership.user.email == "newhire@relish.test"
    assert membership.user.check_password(VALID_PASSWORD)

    invite = Invite.objects.get(token=token)
    assert invite.accepted_at is not None


def test_accept_invite_rejects_unknown_token(api_client):
    resp = api_client.post(
        reverse("accounts:accept_invite"),
        {"token": "does-not-exist", "password": VALID_PASSWORD},
        format="json",
    )
    assert resp.status_code == 400


def test_accept_invite_is_single_use(org):
    from accounts.services.staff import InviteError, invite_staff

    invite = invite_staff(org=org, email="once@relish.test", role_key=ROLE_WAITER)
    accept_invite(token=invite.token, password=VALID_PASSWORD)
    with pytest.raises(InviteError):
        accept_invite(token=invite.token, password=VALID_PASSWORD)


# --- Permissions delta ------------------------------------------------------


def test_set_permissions_shows_in_effective_perms(api_client, org, manager_membership):
    target = Membership.objects.create(
        org=org,
        role=_system_role(ROLE_WAITER),
        display_name="Waiter",
        email="waiter@relish.test",
        status=MEMBERSHIP_ACTIVE,
    )
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:staff_permissions", args=[target.id]),
        {"add": ["void"]},
        format="json",
    )
    assert resp.status_code == 200
    assert "void" in resp.data["perms"]
    assert "void" in target.effective_permission_keys()


def test_set_permissions_service_validates_keys(org):
    from accounts.services.staff import StaffError

    target = Membership.objects.create(
        org=org, role=_system_role(ROLE_WAITER), email="w2@relish.test"
    )
    with pytest.raises(StaffError):
        set_membership_permissions(target, add=["not-a-real-perm"])


# --- Update + deactivate ----------------------------------------------------


def test_patch_changes_role(api_client, org, manager_membership):
    target = Membership.objects.create(
        org=org, role=_system_role(ROLE_WAITER), email="promote@relish.test",
        status=MEMBERSHIP_ACTIVE,
    )
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.patch(
        reverse("accounts:staff_detail", args=[target.id]),
        {"role_key": ROLE_ADMIN},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["role"] == ROLE_ADMIN
    target.refresh_from_db()
    assert target.role.key == ROLE_ADMIN


def test_deactivate_suspends_membership(api_client, org, manager_membership):
    target = Membership.objects.create(
        org=org, role=_system_role(ROLE_WAITER), email="bye@relish.test",
        status=MEMBERSHIP_ACTIVE,
    )
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.post(reverse("accounts:staff_deactivate", args=[target.id]))
    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.status == MEMBERSHIP_SUSPENDED
    assert target.active is False


def test_deactivate_service_sets_flags(org):
    target = Membership.objects.create(
        org=org, role=_system_role(ROLE_WAITER), email="svc@relish.test",
        status=MEMBERSHIP_ACTIVE,
    )
    deactivate_membership(target)
    target.refresh_from_db()
    assert target.status == MEMBERSHIP_SUSPENDED
    assert target.active is False


def test_membership_in_other_org_is_404(api_client, org, manager_membership):
    other_org = Organization.objects.create(name="Rival", slug="rival")
    foreign = Membership.objects.create(
        org=other_org, role=_system_role(ROLE_WAITER), email="foreign@rival.test",
        status=MEMBERSHIP_ACTIVE,
    )
    _auth(api_client, manager_membership, ["manage-staff"])
    resp = api_client.post(reverse("accounts:staff_deactivate", args=[foreign.id]))
    assert resp.status_code == 404
