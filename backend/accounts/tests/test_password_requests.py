"""Tests for the password-change-with-approval slice.

A waiter requests a new password (stored only as a hash); an admin/manager
approves (the user's password flips and refresh tokens are revoked) or rejects.
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.constants import (
    MEMBERSHIP_ACTIVE,
    PWD_REQ_APPROVED,
    PWD_REQ_PENDING,
    PWD_REQ_REJECTED,
    ROLE_MANAGER,
    ROLE_WAITER,
)
from accounts.models import (
    Membership,
    Organization,
    PasswordChangeRequest,
    Role,
)

pytestmark = pytest.mark.django_db

User = get_user_model()

OLD_PASSWORD = "Old-Relish-Pass!42"
NEW_PASSWORD = "New-Relish-Pass!99"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def org():
    return Organization.objects.create(name="Relish Diner", slug="relish-diner")


def _system_role(key: str) -> Role:
    return Role.objects.get(key=key, org__isnull=True)


def _membership(org, role_key, username):
    user = User.objects.create_user(username=username, password=OLD_PASSWORD)
    return Membership.objects.create(
        org=org,
        user=user,
        role=_system_role(role_key),
        display_name=username,
        status=MEMBERSHIP_ACTIVE,
    )


def _auth(client, membership, perms):
    token = RefreshToken.for_user(membership.user)
    token["org_id"] = str(membership.org_id)
    token["membership_id"] = str(membership.id)
    token["role"] = membership.role.key
    token["perms"] = perms
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")


def test_waiter_requests_password_change(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    _auth(api_client, waiter, [])
    resp = api_client.post(
        reverse("accounts:password_request"),
        {"new_password": NEW_PASSWORD},
        format="json",
    )
    assert resp.status_code == 201
    pcr = PasswordChangeRequest.objects.get(requester=waiter)
    assert pcr.status == PWD_REQ_PENDING
    # The proposed password is stored only as a hash, never plaintext.
    assert pcr.new_password_hash != NEW_PASSWORD
    # And not yet applied to the user.
    waiter.user.refresh_from_db()
    assert waiter.user.check_password(OLD_PASSWORD)


def test_one_open_request_at_a_time(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    _auth(api_client, waiter, [])
    url = reverse("accounts:password_request")
    assert api_client.post(url, {"new_password": NEW_PASSWORD}, format="json").status_code == 201
    second = api_client.post(url, {"new_password": NEW_PASSWORD}, format="json")
    assert second.status_code == 400


def test_manager_approves_and_password_flips(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    manager = _membership(org, ROLE_MANAGER, "mira.manager")
    pcr = PasswordChangeRequest.objects.create(
        org=org,
        requester=waiter,
        new_password_hash=__import__(
            "django.contrib.auth.hashers", fromlist=["make_password"]
        ).make_password(NEW_PASSWORD),
        status=PWD_REQ_PENDING,
    )

    _auth(api_client, manager, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:password_approve", args=[pcr.id])
    )
    assert resp.status_code == 200
    pcr.refresh_from_db()
    assert pcr.status == PWD_REQ_APPROVED
    waiter.user.refresh_from_db()
    assert waiter.user.check_password(NEW_PASSWORD)
    assert not waiter.user.check_password(OLD_PASSWORD)


def test_manager_rejects_request(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    manager = _membership(org, ROLE_MANAGER, "mira.manager")
    pcr = PasswordChangeRequest.objects.create(
        org=org, requester=waiter, new_password_hash="x", status=PWD_REQ_PENDING
    )
    _auth(api_client, manager, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:password_reject", args=[pcr.id]),
        {"reason": "Contact your manager in person."},
        format="json",
    )
    assert resp.status_code == 200
    pcr.refresh_from_db()
    assert pcr.status == PWD_REQ_REJECTED
    waiter.user.refresh_from_db()
    assert waiter.user.check_password(OLD_PASSWORD)


def test_waiter_cannot_list_requests(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    _auth(api_client, waiter, [])
    resp = api_client.get(reverse("accounts:password_request_list"))
    assert resp.status_code == 403


def test_admin_reset_password_directly(api_client, org):
    waiter = _membership(org, ROLE_WAITER, "wendy.waiter")
    manager = _membership(org, ROLE_MANAGER, "mira.manager")
    _auth(api_client, manager, ["manage-staff"])
    resp = api_client.post(
        reverse("accounts:staff_reset_password", args=[waiter.id]),
        {"new_password": NEW_PASSWORD},
        format="json",
    )
    assert resp.status_code == 200
    waiter.user.refresh_from_db()
    assert waiter.user.check_password(NEW_PASSWORD)
