"""Tests for the observability stack: request-id, JSON logging, Sentry init."""
from __future__ import annotations

import json
import logging

from django.test import RequestFactory, override_settings

from common.logging import JsonLogFormatter, RequestIDLogFilter
from common.observability import init_sentry
from common.request_id import (
    REQUEST_ID_HEADER,
    RequestIDMiddleware,
    get_request_id,
    reset_request_id,
    set_request_id,
)


# --------------------------------------------------------------------------- #
# RequestIDMiddleware
# --------------------------------------------------------------------------- #
def _capturing_get_response(captured: dict):
    """A dummy ``get_response`` that records the contextvar seen mid-request."""

    def _get_response(request):
        captured["request_id_during_call"] = get_request_id()
        captured["request_attr"] = getattr(request, "request_id", None)
        from django.http import HttpResponse

        return HttpResponse("ok")

    return _get_response


def test_missing_header_generates_request_id():
    captured: dict = {}
    middleware = RequestIDMiddleware(_capturing_get_response(captured))
    request = RequestFactory().get("/")

    response = middleware(request)

    # A fresh id was generated, bound on the request, and echoed on the header.
    assert request.request_id
    assert response[REQUEST_ID_HEADER] == request.request_id
    # uuid4().hex is 32 lowercase hex chars.
    assert len(request.request_id) == 32
    # The contextvar was set *during* the call...
    assert captured["request_id_during_call"] == request.request_id
    assert captured["request_attr"] == request.request_id
    # ...and reset afterwards.
    assert get_request_id() is None


def test_valid_incoming_header_is_preserved():
    captured: dict = {}
    middleware = RequestIDMiddleware(_capturing_get_response(captured))
    incoming = "trace-abc12345"
    request = RequestFactory().get("/", HTTP_X_REQUEST_ID=incoming)

    response = middleware(request)

    assert request.request_id == incoming
    assert response[REQUEST_ID_HEADER] == incoming
    assert captured["request_id_during_call"] == incoming
    assert get_request_id() is None


def test_malformed_incoming_header_is_replaced():
    captured: dict = {}
    middleware = RequestIDMiddleware(_capturing_get_response(captured))
    # Too short + contains a forbidden space -> rejected, regenerated.
    request = RequestFactory().get("/", HTTP_X_REQUEST_ID="bad id")

    response = middleware(request)

    assert request.request_id != "bad id"
    assert len(request.request_id) == 32
    assert response[REQUEST_ID_HEADER] == request.request_id


def test_contextvar_reset_even_when_view_raises():
    def _boom(request):
        raise RuntimeError("view exploded")

    middleware = RequestIDMiddleware(_boom)
    request = RequestFactory().get("/")

    raised = False
    try:
        middleware(request)
    except RuntimeError:
        raised = True

    assert raised
    # ``finally`` reset the contextvar despite the exception.
    assert get_request_id() is None


# --------------------------------------------------------------------------- #
# JsonLogFormatter
# --------------------------------------------------------------------------- #
def _make_record(**extra) -> logging.LogRecord:
    record = logging.LogRecord(
        name="relish.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_formatter_emits_valid_json_with_core_fields():
    formatter = JsonLogFormatter()
    line = formatter.format(_make_record())
    data = json.loads(line)

    assert data["level"] == "INFO"
    assert data["logger"] == "relish.test"
    assert data["message"] == "hello world"
    assert "timestamp" in data
    # No request id bound -> key absent.
    assert "request_id" not in data


def test_formatter_includes_request_id_from_contextvar():
    token = set_request_id("req-xyz98765")
    try:
        line = JsonLogFormatter().format(_make_record())
    finally:
        reset_request_id(token)
    data = json.loads(line)
    assert data["request_id"] == "req-xyz98765"


def test_formatter_merges_serializable_extras():
    formatter = JsonLogFormatter()
    line = formatter.format(_make_record(restaurant_id="rest-1", count=3))
    data = json.loads(line)
    assert data["restaurant_id"] == "rest-1"
    assert data["count"] == 3


def test_formatter_survives_non_serializable_extra():
    formatter = JsonLogFormatter()
    # An open file object is not JSON-serializable; must be dropped, not fatal.
    line = formatter.format(_make_record(payload=object(), ok="yes"))
    data = json.loads(line)
    assert data["message"] == "hello world"
    assert data["ok"] == "yes"
    assert "payload" not in data


def test_formatter_includes_exception_info():
    try:
        raise ValueError("kaboom")
    except ValueError:
        import sys

        record = logging.LogRecord(
            name="relish.test",
            level=logging.ERROR,
            pathname=__file__,
            lineno=20,
            msg="failed",
            args=(),
            exc_info=sys.exc_info(),
        )
    data = json.loads(JsonLogFormatter().format(record))
    assert data["level"] == "ERROR"
    assert "ValueError" in data["exc_info"]


def test_request_id_log_filter_attaches_attribute():
    token = set_request_id("req-filter01")
    try:
        record = _make_record()
        assert RequestIDLogFilter().filter(record) is True
        assert record.request_id == "req-filter01"
    finally:
        reset_request_id(token)


# --------------------------------------------------------------------------- #
# init_sentry
# --------------------------------------------------------------------------- #
@override_settings(SENTRY_DSN="")
def test_init_sentry_returns_false_without_dsn():
    assert init_sentry() is False


def test_init_sentry_no_dsn_attribute_is_false(settings):
    # Simulate a settings module with no SENTRY_DSN attribute at all.
    if hasattr(settings, "SENTRY_DSN"):
        del settings.SENTRY_DSN
    assert init_sentry() is False


@override_settings(SENTRY_DSN="https://example@o0.ingest.sentry.io/0")
def test_init_sentry_no_op_when_sdk_absent_or_present():
    # sentry-sdk is not installed in CI/dev: with a DSN set, init_sentry must
    # not raise. It returns False if the SDK is missing, or True if it happens
    # to be installed -- either way, no exception escapes.
    result = init_sentry()
    assert isinstance(result, bool)
