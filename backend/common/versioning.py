"""Shared optimistic-concurrency (compare-and-swap) primitives.

Several tenant-scoped models (tables, orders, menu items) carry a monotonic
``version`` column and let a client send the version it last read. A write whose
``version`` no longer matches the stored row is rejected with HTTP 409 so the
loser of a race reloads instead of silently clobbering a concurrent edit.

The 409 error type and the lenient request-version parser used to live as
near-identical copies in the floor, order, and menu views. They are centralised
here so there is exactly one definition of "stale version" behaviour.
"""
from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException


class StaleVersionError(APIException):
    """Raised when a write carries a stale optimistic-concurrency token."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This record was modified by someone else. Reload and try again."
    )
    default_code = "stale_version"


def parse_client_version(data: Any) -> int | None:
    """Coerce a supplied ``version`` to ``int``; ``None`` when absent/blank/bad.

    Accepts any mapping-like ``data`` (e.g. ``request.data``). A missing, empty,
    or non-numeric ``version`` returns ``None`` — meaning "no optimistic guard"
    (last write wins) rather than an error, preserving the legacy behaviour for
    callers that do not send a version.
    """
    raw = data.get("version") if hasattr(data, "get") else None
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None
