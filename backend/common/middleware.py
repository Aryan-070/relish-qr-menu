"""Tenant-resolving middleware.

On every request it reads the tenant claims (``restaurant_id`` / ``org_id`` /
``membership_id`` / ``perms``) from the caller's SimpleJWT access token, binds
them to the active-tenant contextvars (:mod:`common.context`), exposes the
permission set on the request (``request.tenant_permissions`` /
``request.membership_id``) for DRF permission classes and views, and — on
Postgres only — mirrors restaurant/org into session GUCs
(``app.current_restaurant`` / ``app.current_org``) so row-level-security
policies can use them as a backstop.

Why we decode the token here instead of reading ``request.auth``: classic
Django middleware runs *before* DRF authentication and receives the plain
``HttpRequest`` (which has no ``.auth``). DRF only populates ``request.auth`` on
its own ``Request`` wrapper inside the view. So to have the tenant bound for the
whole request we validate-and-decode the ``Authorization: Bearer`` token
ourselves (signature + expiry are checked by ``AccessToken``).

The contextvars are always reset in a ``finally`` block. Anonymous or
invalid-token requests are a no-op: the tenant stays ``None``, the permission
set empty, and managers fall back to unscoped-but-not-deleted querysets.

The Postgres GUC step is a guarded no-op on every other backend (SQLite is the
default test/dev DB), and any cursor error is swallowed so a missing GUC never
breaks a request.
"""
from __future__ import annotations

import logging
from collections.abc import Callable

from django.db import connection
from django.http import HttpRequest, HttpResponse
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from common.context import reset_current_tenant, set_current_tenant

logger = logging.getLogger(__name__)

_BEARER_PREFIX = "Bearer "

# The claim bundle a decoded access token yields, inlined on the function below
# as a deferred annotation (``from __future__ import annotations``) so the
# PEP-604 ``|`` syntax is never evaluated at runtime on Python 3.9.


def _coerce_perms(value: object) -> list[str]:
    """Normalise the ``perms`` claim into a list of permission key strings.

    Accepts a JSON list (the contract) and tolerates a missing/``None`` claim
    or any non-iterable junk by returning ``[]``. Strings are NOT split into
    characters — a bare string is treated as a single permission key.
    """
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple, set, frozenset)):
        return [str(perm) for perm in value]
    return []


def _claims_from_request(
    request: HttpRequest,
) -> tuple[str | None, str | None, str | None, list[str]]:
    """Validate-and-decode the Bearer token, returning the tenant claim bundle.

    Returns ``(None, None, None, [])`` when there is no Bearer token or the
    token is invalid/expired — never raises, so unauthenticated traffic flows
    untouched.
    """
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith(_BEARER_PREFIX):
        return None, None, None, []
    raw = header[len(_BEARER_PREFIX):].strip()
    if not raw:
        return None, None, None, []
    try:
        token = AccessToken(raw)
    except TokenError:
        return None, None, None, []
    return (
        token.get("restaurant_id"),
        token.get("org_id"),
        token.get("membership_id"),
        _coerce_perms(token.get("perms")),
    )


def _set_postgres_gucs(restaurant_id: str | None, org_id: str | None) -> None:
    """Mirror the active tenant into Postgres session GUCs (RLS backstop).

    No-op on any non-Postgres backend. Failures are logged at debug level and
    swallowed so the request is never broken by a missing/locked GUC.
    """
    if connection.vendor != "postgresql":
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_restaurant', %s, false)",
                [str(restaurant_id) if restaurant_id is not None else ""],
            )
            cursor.execute(
                "SELECT set_config('app.current_org', %s, false)",
                [str(org_id) if org_id is not None else ""],
            )
    except Exception:  # noqa: BLE001 - GUC is a backstop, never fatal.
        logger.debug("Failed to set Postgres tenant GUCs", exc_info=True)


class TenantMiddleware:
    """Bind the active tenant (from the JWT) for the duration of the request."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        restaurant_id, org_id, membership_id, perms = _claims_from_request(request)

        # Expose to DRF permission classes / views (plain HttpRequest attrs,
        # which DRF's Request wrapper proxies through).
        request.tenant_permissions = set(perms)
        request.membership_id = membership_id

        token = set_current_tenant(restaurant_id, org_id, membership_id, perms)
        try:
            _set_postgres_gucs(restaurant_id, org_id)
            return self.get_response(request)
        finally:
            reset_current_tenant(token)
