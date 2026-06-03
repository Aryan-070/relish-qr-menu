"""Active-tenant context, stored in :mod:`contextvars`.

This module is the single source of truth for "which tenant is this code
running on right now". It is pure Python (no Django imports) so it can be used
from anywhere — middleware, managers, Celery tasks, management commands, tests.

The middleware (:mod:`common.middleware`) sets the values per request and resets
them in a ``finally`` block; managers (:mod:`common.managers`) read them to
auto-scope querysets.

Usage::

    token = set_current_tenant(restaurant_id, org_id)
    try:
        ...  # tenant-scoped work
    finally:
        reset_current_tenant(token)
"""
from __future__ import annotations

from contextvars import ContextVar, Token

# ``None`` means "no tenant bound" (e.g. anonymous request, shell, migrations).
_current_restaurant: ContextVar[str | None] = ContextVar(
    "current_restaurant", default=None
)
_current_org: ContextVar[str | None] = ContextVar("current_org", default=None)

# A token pair returned by ``set_current_tenant`` and consumed by
# ``reset_current_tenant`` to restore the previous values (supports nesting).
TenantToken = tuple[Token, Token]


def get_current_restaurant_id() -> str | None:
    """Return the active restaurant id, or ``None`` when no tenant is bound."""
    return _current_restaurant.get()


def get_current_org_id() -> str | None:
    """Return the active organization id, or ``None`` when no tenant is bound."""
    return _current_org.get()


def set_current_tenant(
    restaurant_id: str | None, org_id: str | None
) -> tuple[Token, Token]:
    """Bind the active tenant and return a token pair for later reset.

    Values are coerced to ``str`` (or kept as ``None``) so callers can pass
    UUID objects, ints, or strings interchangeably.
    """
    restaurant_value = None if restaurant_id is None else str(restaurant_id)
    org_value = None if org_id is None else str(org_id)
    restaurant_token = _current_restaurant.set(restaurant_value)
    org_token = _current_org.set(org_value)
    return restaurant_token, org_token


def reset_current_tenant(token: TenantToken) -> None:
    """Restore the tenant context to its state before ``set_current_tenant``."""
    restaurant_token, org_token = token
    _current_restaurant.reset(restaurant_token)
    _current_org.reset(org_token)
