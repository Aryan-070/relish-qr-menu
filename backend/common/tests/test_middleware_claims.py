"""Tests for tenant-claim extraction + context binding in the middleware."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from common.context import (
    get_current_membership_id,
    get_current_org_id,
    get_current_permissions,
    get_current_restaurant_id,
    reset_current_tenant,
    set_current_tenant,
)
from common.middleware import (
    TenantMiddleware,
    _claims_from_request,
    _coerce_perms,
)

pytestmark = pytest.mark.django_db

User = get_user_model()


def _make_request(authorization: str | None) -> object:
    """A minimal duck-typed request carrying only ``META`` (what the parser reads)."""

    class _Req:
        def __init__(self, header: str | None) -> None:
            self.META: dict[str, str] = {}
            if header is not None:
                self.META["HTTP_AUTHORIZATION"] = header

    return _Req(authorization)


def _access_token_with_claims() -> str:
    user = User.objects.create_user(email="claims@relish.test", password="x")
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    access["restaurant_id"] = "rest-1"
    access["org_id"] = "org-9"
    access["membership_id"] = "mem-7"
    access["role"] = "manager"
    access["perms"] = ["manage-staff", "edit-menu"]
    return str(access)


# --- _coerce_perms ----------------------------------------------------------


def test_coerce_perms_none_is_empty():
    assert _coerce_perms(None) == []


def test_coerce_perms_list_passthrough():
    assert _coerce_perms(["a", "b"]) == ["a", "b"]


def test_coerce_perms_bare_string_is_single_key():
    # A string must NOT be exploded into characters.
    assert _coerce_perms("manage-staff") == ["manage-staff"]


def test_coerce_perms_junk_is_empty():
    assert _coerce_perms(42) == []


# --- _claims_from_request ---------------------------------------------------


def test_claims_anonymous_request_all_empty():
    rid, oid, mid, perms = _claims_from_request(_make_request(None))
    assert rid is None
    assert oid is None
    assert mid is None
    assert perms == []


def test_claims_non_bearer_header_all_empty():
    rid, oid, mid, perms = _claims_from_request(_make_request("Basic abc"))
    assert (rid, oid, mid, perms) == (None, None, None, [])


def test_claims_invalid_token_all_empty():
    rid, oid, mid, perms = _claims_from_request(_make_request("Bearer not-a-jwt"))
    assert (rid, oid, mid, perms) == (None, None, None, [])


def test_claims_decoded_from_valid_token():
    token = _access_token_with_claims()
    rid, oid, mid, perms = _claims_from_request(_make_request(f"Bearer {token}"))
    assert rid == "rest-1"
    assert oid == "org-9"
    assert mid == "mem-7"
    assert perms == ["manage-staff", "edit-menu"]


# --- TenantMiddleware end-to-end (context + request attributes) -------------


def test_middleware_binds_context_and_request_attrs():
    token = _access_token_with_claims()
    captured: dict[str, object] = {}

    def get_response(request):
        captured["restaurant"] = get_current_restaurant_id()
        captured["org"] = get_current_org_id()
        captured["membership"] = get_current_membership_id()
        captured["perms"] = get_current_permissions()
        captured["req_perms"] = request.tenant_permissions
        captured["req_membership"] = request.membership_id
        return "ok"

    middleware = TenantMiddleware(get_response)
    request = _make_request(f"Bearer {token}")

    result = middleware(request)

    assert result == "ok"
    assert captured["restaurant"] == "rest-1"
    assert captured["org"] == "org-9"
    assert captured["membership"] == "mem-7"
    assert captured["perms"] == frozenset({"manage-staff", "edit-menu"})
    assert captured["req_perms"] == {"manage-staff", "edit-menu"}
    assert captured["req_membership"] == "mem-7"

    # Context is reset after the request.
    assert get_current_restaurant_id() is None
    assert get_current_permissions() == frozenset()


def test_middleware_anonymous_request_is_inert():
    captured: dict[str, object] = {}

    def get_response(request):
        captured["restaurant"] = get_current_restaurant_id()
        captured["perms"] = get_current_permissions()
        captured["req_perms"] = request.tenant_permissions
        captured["req_membership"] = request.membership_id
        return "ok"

    middleware = TenantMiddleware(get_response)
    middleware(_make_request(None))

    assert captured["restaurant"] is None
    assert captured["perms"] == frozenset()
    assert captured["req_perms"] == set()
    assert captured["req_membership"] is None


# --- context round-trip with the richer signature ---------------------------


def test_context_round_trip_with_membership_and_permissions():
    token = set_current_tenant("r", "o", "m", ["p1", "p2"])
    try:
        assert get_current_restaurant_id() == "r"
        assert get_current_org_id() == "o"
        assert get_current_membership_id() == "m"
        assert get_current_permissions() == frozenset({"p1", "p2"})
    finally:
        reset_current_tenant(token)
    assert get_current_membership_id() is None
    assert get_current_permissions() == frozenset()


def test_context_two_arg_signature_still_works():
    # Backwards compatibility for billing/accounts callers.
    token = set_current_tenant("r", "o")
    try:
        assert get_current_restaurant_id() == "r"
        assert get_current_org_id() == "o"
        assert get_current_membership_id() is None
        assert get_current_permissions() == frozenset()
    finally:
        reset_current_tenant(token)
