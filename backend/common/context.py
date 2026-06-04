"""Active-tenant context, stored in :mod:`contextvars`.

This module is the single source of truth for "which tenant is this code
running on right now". It is pure Python (no Django imports) so it can be used
from anywhere — middleware, managers, Celery tasks, management commands, tests.

The middleware (:mod:`common.middleware`) sets the values per request and resets
them in a ``finally`` block; managers (:mod:`common.managers`) read them to
auto-scope querysets; permissions (:mod:`common.permissions`) read the
membership + permission set.

Usage::

    token = set_current_tenant(restaurant_id, org_id, membership_id, permissions)
    try:
        ...  # tenant-scoped work
    finally:
        reset_current_tenant(token)

The 2-arg call ``set_current_tenant(restaurant_id, org_id)`` is still supported
for backwards compatibility (``billing`` / ``accounts`` callers).
"""
from __future__ import annotations

from collections.abc import Iterable
from contextvars import ContextVar, Token

# ``None`` means "no tenant bound" (e.g. anonymous request, shell, migrations).
_current_restaurant: ContextVar[str | None] = ContextVar(
    "current_restaurant", default=None
)
_current_org: ContextVar[str | None] = ContextVar("current_org", default=None)
_current_membership: ContextVar[str | None] = ContextVar(
    "current_membership", default=None
)
# Empty frozenset means "no permissions bound" (anonymous / membership-less).
_current_permissions: ContextVar[frozenset[str]] = ContextVar(
    "current_permissions", default=frozenset()
)

# A token bundle returned by ``set_current_tenant`` and consumed by
# ``reset_current_tenant`` to restore the previous values (supports nesting).
TenantToken = tuple[Token, Token, Token, Token]


def get_current_restaurant_id() -> str | None:
    """Return the active restaurant id, or ``None`` when no tenant is bound."""
    return _current_restaurant.get()


def get_current_org_id() -> str | None:
    """Return the active organization id, or ``None`` when no tenant is bound."""
    return _current_org.get()


def get_current_membership_id() -> str | None:
    """Return the active membership id, or ``None`` when none is bound."""
    return _current_membership.get()


def get_current_permissions() -> frozenset[str]:
    """Return the active permission key set (empty ``frozenset`` by default)."""
    return _current_permissions.get()


def set_current_tenant(
    restaurant_id: str | None,
    org_id: str | None,
    membership_id: str | None = None,
    permissions: Iterable[str] = (),
) -> TenantToken:
    """Bind the active tenant and return a token bundle for later reset.

    Scalar values are coerced to ``str`` (or kept as ``None``) so callers can
    pass UUID objects, ints, or strings interchangeably. ``permissions`` is
    normalised to a ``frozenset[str]``.

    The 2-arg signature ``set_current_tenant(restaurant_id, org_id)`` remains
    valid; ``membership_id`` and ``permissions`` default to "unset".
    """
    restaurant_value = None if restaurant_id is None else str(restaurant_id)
    org_value = None if org_id is None else str(org_id)
    membership_value = None if membership_id is None else str(membership_id)
    permission_value = frozenset(str(perm) for perm in permissions)

    restaurant_token = _current_restaurant.set(restaurant_value)
    org_token = _current_org.set(org_value)
    membership_token = _current_membership.set(membership_value)
    permissions_token = _current_permissions.set(permission_value)
    return restaurant_token, org_token, membership_token, permissions_token


def reset_current_tenant(token: TenantToken) -> None:
    """Restore the tenant context to its state before ``set_current_tenant``."""
    restaurant_token, org_token, membership_token, permissions_token = token
    _current_restaurant.reset(restaurant_token)
    _current_org.reset(org_token)
    _current_membership.reset(membership_token)
    _current_permissions.reset(permissions_token)
