"""Tests for the RBAC permission classes."""
from __future__ import annotations

from types import SimpleNamespace

from rest_framework.test import APIRequestFactory

from common.permissions import HasAnyPermission, HasPermission, IsTenantMember

factory = APIRequestFactory()


def _request(permissions=None, *, is_superuser=False, authenticated=True):
    request = factory.get("/")
    request.user = SimpleNamespace(
        is_superuser=is_superuser,
        is_authenticated=authenticated,
    )
    if permissions is not None:
        request.tenant_permissions = set(permissions)
    return request


# --- HasPermission ----------------------------------------------------------


def test_has_permission_grants_when_present():
    perm = HasPermission("manage-staff")()
    assert perm.has_permission(_request({"manage-staff"}), view=None) is True


def test_has_permission_denies_when_absent():
    perm = HasPermission("refund")()
    assert perm.has_permission(_request({"manage-staff"}), view=None) is False


def test_has_permission_denies_when_attr_missing():
    perm = HasPermission("manage-staff")()
    request = factory.get("/")
    request.user = SimpleNamespace(is_superuser=False, is_authenticated=True)
    # No tenant_permissions attribute at all → defaults to empty set → deny.
    assert perm.has_permission(request, view=None) is False


def test_superuser_bypasses_has_permission():
    perm = HasPermission("refund")()
    request = _request(set(), is_superuser=True)
    assert perm.has_permission(request, view=None) is True


def test_has_permission_class_name_is_descriptive():
    cls = HasPermission("menu.edit")
    assert cls.__name__ == "HasPermission_menu_edit"


# --- HasAnyPermission -------------------------------------------------------


def test_has_any_permission_grants_on_intersection():
    perm = HasAnyPermission("refund", "manage-staff")()
    assert perm.has_permission(_request({"manage-staff"}), view=None) is True


def test_has_any_permission_denies_without_intersection():
    perm = HasAnyPermission("refund", "void-order")()
    assert perm.has_permission(_request({"manage-staff"}), view=None) is False


def test_has_any_permission_superuser_bypasses():
    perm = HasAnyPermission("refund")()
    assert perm.has_permission(_request(set(), is_superuser=True), view=None) is True


def test_has_any_permission_empty_denies_non_superuser():
    perm = HasAnyPermission()()
    assert perm.has_permission(_request({"anything"}), view=None) is False


# --- IsTenantMember (org-bound) ---------------------------------------------


def test_is_tenant_member_requires_authentication():
    perm = IsTenantMember()
    request = _request(authenticated=False)
    assert perm.has_permission(request, view=None) is False


def test_is_tenant_member_requires_bound_org(monkeypatch):
    monkeypatch.setattr(
        "common.context.get_current_org_id", lambda: None
    )
    perm = IsTenantMember()
    assert perm.has_permission(_request(), view=None) is False


def test_is_tenant_member_passes_with_bound_org(monkeypatch):
    monkeypatch.setattr(
        "common.context.get_current_org_id", lambda: "org-1"
    )
    perm = IsTenantMember()
    assert perm.has_permission(_request(), view=None) is True


def test_is_tenant_member_superuser_bypasses_org_requirement(monkeypatch):
    monkeypatch.setattr(
        "common.context.get_current_org_id", lambda: None
    )
    perm = IsTenantMember()
    request = _request(is_superuser=True)
    assert perm.has_permission(request, view=None) is True
