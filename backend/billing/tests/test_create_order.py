"""Tests for the Razorpay order-create endpoint.

These cover the ownership invariant (caller's org must own the invoice) and the
server-derived-amount invariant (the charge equals ``invoice.total_minor``, never
a client-supplied value).
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from billing.models import Invoice

User = get_user_model()


def _make_invoice(org_id: uuid.UUID, code: str = "INV-0001") -> Invoice:
    return Invoice.objects.create(
        code=code,
        org_id=org_id,
        description="Annual renewal",
        base_minor=10000,
        gst_minor=1800,
        total_minor=11800,
    )


def _auth_client(org_id: uuid.UUID) -> APIClient:
    user = User.objects.create_user(
        email=f"u-{uuid.uuid4().hex[:8]}@relish.test",
        password="pw-test-12345",  # noqa: S106 — test fixture
    )
    token = RefreshToken.for_user(user)
    token["org_id"] = str(org_id)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.mark.django_db
def test_anonymous_is_unauthorized():
    invoice = _make_invoice(uuid.uuid4())
    resp = APIClient().post(
        reverse("billing:create_order"),
        {"invoice_id": str(invoice.id)},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_other_org_is_forbidden():
    invoice_org = uuid.uuid4()
    caller_org = uuid.uuid4()
    invoice = _make_invoice(invoice_org)
    client = _auth_client(caller_org)

    resp = client.post(
        reverse("billing:create_order"),
        {"invoice_id": str(invoice.id)},
        format="json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="rzp_test_secret")
@patch("billing.services.requests.post")
def test_owner_creates_order_with_server_derived_amount(mock_post):
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "id": "order_ABC123",
        "amount": 11800,
        "currency": "INR",
    }

    org_id = uuid.uuid4()
    invoice = _make_invoice(org_id)
    client = _auth_client(org_id)

    # Client attempts to smuggle a bogus amount — it must be ignored.
    resp = client.post(
        reverse("billing:create_order"),
        {"invoice_id": str(invoice.id), "amount": 1},
        format="json",
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["order_id"] == "order_ABC123"
    assert data["amount"] == invoice.total_minor
    assert data["currency"] == "INR"

    # The amount sent to Razorpay is the invoice total, not the client value.
    assert mock_post.call_count == 1
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["amount"] == invoice.total_minor
    assert kwargs["json"]["receipt"] == invoice.code


@pytest.mark.django_db
def test_missing_invoice_is_not_found():
    org_id = uuid.uuid4()
    client = _auth_client(org_id)

    resp = client.post(
        reverse("billing:create_order"),
        {"invoice_id": str(uuid.uuid4())},
        format="json",
    )

    assert resp.status_code == 404
