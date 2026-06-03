"""Tests for the consistent error-envelope exception handler."""
from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, ValidationError

from common.exceptions import custom_exception_handler


def _context():
    """A minimal context dict accepted by DRF's default handler."""
    return {"view": None, "request": None}


def test_validation_error_wrapped_in_envelope():
    exc = ValidationError({"name": ["This field is required."]})

    response = custom_exception_handler(exc, _context())

    assert response is not None
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["success"] is False
    assert "error" in response.data
    assert response.data["detail"] == {"name": ["This field is required."]}


def test_not_authenticated_preserves_status_code():
    exc = NotAuthenticated()

    response = custom_exception_handler(exc, _context())

    assert response is not None
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["success"] is False
    assert response.data["error"]


def test_unhandled_exception_returns_none():
    # DRF's default handler returns None for non-API exceptions; we mirror that
    # so Django renders its standard 500.
    response = custom_exception_handler(ZeroDivisionError("boom"), _context())

    assert response is None
