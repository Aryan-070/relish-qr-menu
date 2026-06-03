"""Consistent API error envelope.

Wraps DRF's default exception handler so every handled error returns the same
shape while preserving DRF's status code::

    {"success": false, "error": "<short label>", "detail": <original data>}

If the default handler returns ``None`` (an exception DRF does not handle, e.g.
a raw ``ZeroDivisionError``), we return ``None`` too and let Django produce its
standard 500 response.
"""
from __future__ import annotations

from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def _short_label(exc: Any, status_code: int) -> str:
    """Derive a short, human-readable error label for the envelope."""
    default_detail = getattr(exc, "default_detail", None)
    if default_detail:
        return str(default_detail)
    if status_code >= 500:
        return "Server error."
    return exc.__class__.__name__


def custom_exception_handler(exc: Exception, context: Any) -> Response | None:
    """Return the standard envelope for handled errors; ``None`` otherwise."""
    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled by DRF — let Django render its default 500.
        return None

    response.data = {
        "success": False,
        "error": _short_label(exc, response.status_code),
        "detail": response.data,
    }
    return response
