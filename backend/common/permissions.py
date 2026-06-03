"""Permission primitives for the tenant-scoped API.

``HasPermission`` is a factory: ``HasPermission("menu.edit")`` returns a DRF
``BasePermission`` subclass that grants access when the caller holds that
permission string.

Phase 0 source of truth (forward-compatible hook): the effective permission set
is read from ``request.tenant_permissions`` (a ``set[str]``), which Phase 1's
membership-aware middleware will populate from the active ``Membership`` row.
Until then the set is empty for normal users; Django superusers always pass.
"""
from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission


def _is_superuser(request: Any) -> bool:
    user = getattr(request, "user", None)
    return bool(user and getattr(user, "is_superuser", False))


def HasPermission(required: str) -> type[BasePermission]:  # noqa: N802 - factory.
    """Return a ``BasePermission`` subclass requiring ``required``.

    The returned class checks ``required`` against the caller's effective
    permission set (``request.tenant_permissions``). Superusers bypass the
    check. Phase 1 wires the real source onto the request.
    """

    class _HasPermission(BasePermission):
        message = f"You do not have the required permission: {required}."

        def has_permission(self, request: Any, view: Any) -> bool:
            if _is_superuser(request):
                return True
            permissions = getattr(request, "tenant_permissions", set())
            return required in permissions

    _HasPermission.__name__ = f"HasPermission_{required.replace('.', '_')}"
    _HasPermission.__qualname__ = _HasPermission.__name__
    return _HasPermission


class IsTenantMember(BasePermission):
    """Allow authenticated callers that carry an active restaurant claim."""

    message = "You must be a member of a restaurant to access this resource."

    def has_permission(self, request: Any, view: Any) -> bool:
        user = getattr(request, "user", None)
        if not (user and getattr(user, "is_authenticated", False)):
            return False
        if getattr(user, "is_superuser", False):
            return True
        from common.context import get_current_restaurant_id

        return get_current_restaurant_id() is not None
