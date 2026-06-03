"""Structured JSON logging for the Relish backend.

:class:`JsonLogFormatter` renders each log record as a single-line JSON object
suitable for ingestion by log aggregators (Loki, CloudWatch, Datadog, etc.). It
always includes ``timestamp`` / ``level`` / ``logger`` / ``message`` and, when
one is bound, the active ``request_id`` (from :mod:`common.request_id`). Any
JSON-serializable extras passed via ``logger.info(..., extra={...})`` are merged
in, with the internal :mod:`logging` bookkeeping attributes filtered out.

The formatter is defensive by contract: :meth:`JsonLogFormatter.format` must
never raise, because a logging failure should never take down a request. On any
serialization error it falls back to a plain string representation of the
record.

Wire it in ``settings.LOGGING`` as::

    "formatters": {"json": {"()": "common.logging.JsonLogFormatter"}}
"""
from __future__ import annotations

import datetime as _dt
import json
import logging

from common.request_id import get_request_id

# Attributes present on every ``logging.LogRecord`` that are internal plumbing
# rather than user-supplied extras. Anything in ``record.__dict__`` NOT in this
# set (and not already emitted explicitly) is treated as an ``extra``.
_RESERVED_RECORD_ATTRS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
        # Our own explicitly-emitted / filter-attached keys:
        "request_id",
    }
)


def _is_json_serializable(value: object) -> bool:
    """Return ``True`` if ``value`` can be encoded by :func:`json.dumps`."""
    try:
        json.dumps(value)
    except (TypeError, ValueError):
        return False
    return True


def _iso_timestamp(created: float) -> str:
    """Return an ISO-8601 UTC timestamp for a record ``created`` epoch float."""
    return _dt.datetime.fromtimestamp(created, tz=_dt.timezone.utc).isoformat()


class JsonLogFormatter(logging.Formatter):
    """Format log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        try:
            return self._format(record)
        except Exception:  # noqa: BLE001 - formatting must never raise.
            # Last-resort fallback: a plain, always-safe string. We deliberately
            # avoid re-entering JSON encoding here.
            try:
                return f"{record.levelname} {record.name} {record.getMessage()}"
            except Exception:  # noqa: BLE001
                return str(record.msg)

    def _format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": _iso_timestamp(record.created),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = get_request_id()
        if request_id is not None:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = self.formatStack(record.stack_info)

        # Merge in JSON-serializable extras, never clobbering the core keys and
        # silently dropping anything that cannot be encoded.
        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_ATTRS or key in payload:
                continue
            if _is_json_serializable(value):
                payload[key] = value

        return json.dumps(payload, default=str, separators=(",", ":"))


class RequestIDLogFilter(logging.Filter):
    """Attach the active ``request_id`` to every record passing through.

    Optional helper: :class:`JsonLogFormatter` already reads the contextvar
    directly, but installing this filter makes ``%(request_id)s`` usable from a
    plain text formatter too, and guarantees the attribute exists on the record.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True
