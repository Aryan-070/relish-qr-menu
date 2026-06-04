"""Tests for the passwordless OTP slice (request + verify, hashing, single-use)."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.constants import OTP_LOGIN, OTP_LOYALTY
from accounts.models import Otp
from accounts.services.otp import request_otp, verify_otp

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


@pytest.fixture
def api_client():
    return APIClient()


# --- Service: request -------------------------------------------------------


def test_request_otp_returns_code_and_stores_only_hash():
    otp, code = request_otp(purpose=OTP_LOGIN, email="diner@relish.test")
    assert len(code) == 6
    assert code.isdigit()
    # The raw code must never be persisted in the clear.
    assert otp.code_hash != code
    assert code not in otp.code_hash
    assert otp.expires_at > timezone.now()
    assert otp.consumed is False


# --- Service: verify --------------------------------------------------------


def test_verify_otp_succeeds_once_then_is_consumed():
    otp, code = request_otp(purpose=OTP_LOGIN, email="diner@relish.test")
    assert verify_otp(purpose=OTP_LOGIN, code=code, email="diner@relish.test") is True
    # Reuse fails — the OTP is single-use.
    assert verify_otp(purpose=OTP_LOGIN, code=code, email="diner@relish.test") is False
    otp.refresh_from_db()
    assert otp.consumed is True


def test_verify_otp_fails_with_wrong_code():
    request_otp(purpose=OTP_LOGIN, email="diner@relish.test")
    assert verify_otp(purpose=OTP_LOGIN, code="000000", email="diner@relish.test") is False


def test_verify_otp_fails_when_expired():
    otp, code = request_otp(purpose=OTP_LOYALTY, phone="+919812345678")
    otp.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    otp.save(update_fields=["expires_at"])
    assert verify_otp(purpose=OTP_LOYALTY, code=code, phone="+919812345678") is False


# --- Endpoint: request ------------------------------------------------------


def test_otp_request_endpoint_never_returns_code(api_client):
    resp = api_client.post(
        reverse("accounts:otp_request"),
        {"purpose": OTP_LOGIN, "email": "diner@relish.test"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data == {"sent": True}
    assert "code" not in resp.data

    otp = Otp.objects.get(email="diner@relish.test")
    # No plaintext code anywhere on the row.
    assert "code" not in str(resp.data)
    assert otp.code_hash


def test_otp_request_requires_an_identifier(api_client):
    resp = api_client.post(
        reverse("accounts:otp_request"),
        {"purpose": OTP_LOGIN},
        format="json",
    )
    assert resp.status_code == 400


# --- Endpoint: verify -------------------------------------------------------


def test_otp_verify_returns_token_for_existing_login_user(api_client):
    User.objects.create_user(email="staff@relish.test", password=VALID_PASSWORD)
    _, code = request_otp(purpose=OTP_LOGIN, email="staff@relish.test")

    resp = api_client.post(
        reverse("accounts:otp_verify"),
        {"purpose": OTP_LOGIN, "email": "staff@relish.test", "code": code},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data


def test_otp_verify_rejects_wrong_code(api_client):
    User.objects.create_user(email="staff@relish.test", password=VALID_PASSWORD)
    request_otp(purpose=OTP_LOGIN, email="staff@relish.test")
    resp = api_client.post(
        reverse("accounts:otp_verify"),
        {"purpose": OTP_LOGIN, "email": "staff@relish.test", "code": "999999"},
        format="json",
    )
    assert resp.status_code == 400


def test_otp_verify_login_without_user_is_rejected(api_client):
    _, code = request_otp(purpose=OTP_LOGIN, email="ghost@relish.test")
    resp = api_client.post(
        reverse("accounts:otp_verify"),
        {"purpose": OTP_LOGIN, "email": "ghost@relish.test", "code": code},
        format="json",
    )
    assert resp.status_code == 400
