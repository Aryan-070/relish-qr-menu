"""Per-request correlation id, stored in :mod:`contextvars`.

This module owns a single ``request_id`` contextvar plus a callable-style
middleware that binds it for the duration of each request. The id is exposed on
the request object (``request.request_id``), echoed back to the caller on the
``X-Request-ID`` response header, and made available to log records through the
contextvar (see :mod:`common.logging`).

It is intentionally independent of :mod:`common.context`: the request-id is a
transport/observability concern, not a tenant concern, so it lives in its own
module and does not touch ``common/context.py``.

The middleware honours an inbound ``X-Request-ID`` header when it is present and
well-formed (so a gateway / load balancer can supply a trace id), otherwise it
mints a fresh ``uuid4().hex``. The contextvar is always reset in a ``finally``
block — even if the view raises — so ids never leak between requests on a reused
worker thread.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from contextvars import ContextVar, Token

from django.http import HttpRequest, HttpResponse

# Header name (HTTP form) and the WSGI/Django ``META`` key it arrives under.
REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_META_KEY = "HTTP_X_REQUEST_ID"

# An incoming id is accepted only if it is a short, safe token: alphanumerics,
# dashes, and underscores, 8-128 chars. Anything else (empty, whitespace,
# header-injection attempts, absurdly long values) is rejected and replaced
# with a freshly generated id.
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{8,128}$")

# ``None`` means "no request id bound" (e.g. shell, Celery task, migrations).
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """Return the active request id, or ``None`` when none is bound."""
    return _request_id.get()


def set_request_id(value: str) -> Token:
    """Bind ``value`` as the active request id; return a reset token."""
    return _request_id.set(value)


def reset_request_id(token: Token) -> None:
    """Restore the request id to its state before :func:`set_request_id`."""
    _request_id.reset(token)


def _new_request_id() -> str:
    """Generate a fresh request id (a ``uuid4`` hex string)."""
    # Imported lazily so a present, valid inbound header path never pays the
    # (tiny) ``uuid`` import cost, and so this module imports cleanly even if
    # ``uuid`` resolution is patched in unusual test environments.
    import uuid

    return uuid.uuid4().hex


def _resolve_request_id(request: HttpRequest) -> str:
    """Return a valid request id for ``request`` (inbound header or generated)."""
    incoming = request.META.get(REQUEST_ID_META_KEY, "")
    if isinstance(incoming, str):
        candidate = incoming.strip()
        if _VALID_REQUEST_ID.match(candidate):
            return candidate
    return _new_request_id()


class RequestIDMiddleware:
    """Bind a request id for the request and echo it on the response header.

    Should be installed early in ``MIDDLEWARE`` (before tenant/auth middleware)
    so the id is available to everything downstream, including log records
    emitted by other middleware.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = _resolve_request_id(request)
        request.request_id = request_id
        token = set_request_id(request_id)
        try:
            response = self.get_response(request)
            response[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            reset_request_id(token)
