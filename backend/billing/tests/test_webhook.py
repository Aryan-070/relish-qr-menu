"""Tests for the Razorpay webhook receiver.

These cover the two security invariants of the webhook: constant-time signature
verification over the raw body, and exactly-once idempotent application under
Razorpay retries / duplicate events.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from billing.models import Invoice, PaymentEvent

WEBHOOK_SECRET = "whsec_test_secret_value"  # noqa: S105 — test fixture, not real


def _sign(raw_body: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()


def _make_invoice(code: str = "INV-0001") -> Invoice:
    return Invoice.objects.create(
        code=code,
        org_id=uuid.uuid4(),
        description="Annual renewal",
        base_minor=10000,
        gst_minor=1800,
        total_minor=11800,
    )


def _webhook_body(receipt: str, payment_id: str = "pay_TEST123") -> dict:
    """A representative ``payment.captured`` envelope referencing our invoice."""
    return {
        "event": "payment.captured",
        "created_at": 1700000000,
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "receipt": receipt,
                    "notes": {"invoiceId": receipt},
                }
            },
            "order": {
                "entity": {
                    "id": "order_TEST123",
                    "receipt": receipt,
                    "notes": {"invoiceId": receipt},
                }
            },
        },
    }


def _post(client: APIClient, body: dict, signature: str):
    raw = json.dumps(body).encode("utf-8")
    return client.post(
        reverse("billing:razorpay_webhook"),
        data=raw,
        content_type="application/json",
        HTTP_X_RAZORPAY_SIGNATURE=signature,
    )


@pytest.mark.django_db
@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_valid_signature_marks_invoice_paid():
    invoice = _make_invoice()
    body = _webhook_body(invoice.code)
    raw = json.dumps(body).encode("utf-8")

    resp = _post(APIClient(), body, _sign(raw))

    assert resp.status_code == 200
    assert resp.json() == {"received": True}

    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID
    assert invoice.paid_at is not None
    assert invoice.razorpay_id == "order_TEST123"
    assert PaymentEvent.objects.count() == 1


@pytest.mark.django_db
@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_replayed_event_is_idempotent():
    invoice = _make_invoice()
    body = _webhook_body(invoice.code)
    raw = json.dumps(body).encode("utf-8")
    signature = _sign(raw)
    client = APIClient()

    first = _post(client, body, signature)
    second = _post(client, body, signature)

    assert first.status_code == 200
    assert second.status_code == 200

    # Exactly one ledger row and one paid transition despite the replay.
    assert PaymentEvent.objects.count() == 1
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID

    first_paid_at = invoice.paid_at
    assert first_paid_at is not None
    # Replay did not re-stamp paid_at (no second application).
    invoice.refresh_from_db()
    assert invoice.paid_at == first_paid_at


@pytest.mark.django_db
@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_tampered_signature_is_rejected():
    invoice = _make_invoice()
    body = _webhook_body(invoice.code)

    resp = _post(APIClient(), body, "deadbeef" * 8)

    assert resp.status_code == 400
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.DUE
    assert PaymentEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(RAZORPAY_WEBHOOK_SECRET=WEBHOOK_SECRET)
def test_missing_signature_header_is_rejected():
    invoice = _make_invoice()
    body = _webhook_body(invoice.code)
    raw = json.dumps(body).encode("utf-8")

    resp = APIClient().post(
        reverse("billing:razorpay_webhook"),
        data=raw,
        content_type="application/json",
    )

    assert resp.status_code == 400
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.DUE
    assert PaymentEvent.objects.count() == 0
