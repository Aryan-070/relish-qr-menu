"""Permission primitives for the tenant-scoped API.

``HasPermission`` is a factory: ``HasPermission("menu.edit")`` returns a DRF
``BasePermission`` subclass that grants access when the caller holds that
permission key. ``HasAnyPermission("a", "b")`` grants access when the caller
holds *any* of the listed keys.

Source of truth: the effective permission set is read from
``request.tenant_permissions`` (a ``set[str]``), which the membership-aware
:class:`common.middleware.TenantMiddleware` populates from the JWT ``perms``
claim. Anonymous / membership-less callers carry an empty set; Django
superusers always pass.
"""
from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission


def _is_superuser(request: Any) -> bool:
    user = getattr(request, "user", None)
    return bool(user and getattr(user, "is_superuser", False))


def _tenant_permissions(request: Any) -> set[str]:
    return getattr(request, "tenant_permissions", set())


def HasPermission(required: str) -> type[BasePermission]:  # noqa: N802 - factory.
    """Return a ``BasePermission`` subclass requiring ``required``.

    The returned class grants access when ``request.user`` is a superuser OR
    ``required`` is present in the caller's effective permission set
    (``request.tenant_permissions``).
    """

    class _HasPermission(BasePermission):
        message = f"You do not have the required permission: {required}."

        def has_permission(self, request: Any, view: Any) -> bool:
            if _is_superuser(request):
                return True
            return required in _tenant_permissions(request)

    _HasPermission.__name__ = f"HasPermission_{required.replace('.', '_')}"
    _HasPermission.__qualname__ = _HasPermission.__name__
    return _HasPermission


def HasAnyPermission(*required: str) -> type[BasePermission]:  # noqa: N802 - factory.
    """Return a ``BasePermission`` subclass requiring ANY of ``required``.

    Grants access when ``request.user`` is a superuser OR the caller's
    effective permission set intersects ``required``. With no arguments it
    denies all non-superusers (an empty "any-of" is never satisfiable).
    """
    needed = frozenset(required)

    class _HasAnyPermission(BasePermission):
        message = "You do not have any of the required permissions: " + (
            ", ".join(sorted(needed)) or "(none specified)"
        ) + "."

        def has_permission(self, request: Any, view: Any) -> bool:
            if _is_superuser(request):
                return True
            return bool(needed & _tenant_permissions(request))

    suffix = "_".join(key.replace(".", "_") for key in sorted(needed)) or "none"
    _HasAnyPermission.__name__ = f"HasAnyPermission_{suffix}"
    _HasAnyPermission.__qualname__ = _HasAnyPermission.__name__
    return _HasAnyPermission


class IsTenantMember(BasePermission):
    """Allow authenticated callers bound to an active organization."""

    message = "You must be a member of a restaurant to access this resource."

    def has_permission(self, request: Any, view: Any) -> bool:
        user = getattr(request, "user", None)
        if not (user and getattr(user, "is_authenticated", False)):
            return False
        if getattr(user, "is_superuser", False):
            return True
        from common.context import get_current_org_id

        return get_current_org_id() is not None
