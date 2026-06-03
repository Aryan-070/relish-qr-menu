"""Razorpay integration services: signature verification, idempotent event
application, and order creation.

The three security-critical primitives of the billing slice live here so they can
be unit-tested in isolation and reused from views, tasks, or the shell.
"""
from __future__ import annotations

import hashlib
import hmac
from typing import Any

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice, PaymentEvent

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
_ORDER_TIMEOUT_SECONDS = 15


class RazorpayConfigError(RuntimeError):
    """Raised when Razorpay API credentials are not configured."""


class RazorpayError(RuntimeError):
    """Raised when the Razorpay API returns a non-2xx response."""


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify a Razorpay webhook signature in constant time.

    The HMAC is computed over the **exact raw request body bytes** — never a
    re-serialized payload — and compared with :func:`hmac.compare_digest` to
    avoid timing side channels. Returns ``False`` (rather than raising) when the
    webhook secret is unset or the signature is missing/empty, so callers can
    uniformly reject with a 400.
    """
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "") or ""
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _resolve_invoice(payload: dict[str, Any]) -> Invoice | None:
    """Resolve the target invoice from a webhook payload.

    Razorpay surfaces our invoice ``code`` in two places depending on the event:
    the order ``receipt`` and ``notes.invoiceId`` (we set both when creating the
    order). We try each in turn and return the first matching invoice, or
    ``None`` if the payload references no known invoice.
    """
    candidates: list[str] = []

    receipt = payload.get("receipt")
    if isinstance(receipt, str) and receipt:
        candidates.append(receipt)

    notes = payload.get("notes")
    if isinstance(notes, dict):
        invoice_id = notes.get("invoiceId")
        if isinstance(invoice_id, str) and invoice_id:
            candidates.append(invoice_id)

    for code in candidates:
        invoice = Invoice.objects.filter(code=code).first()
        if invoice is not None:
            return invoice
    return None


def record_and_apply_event(event_id: str, kind: str, payload: dict[str, Any]) -> bool:
    """Idempotently record a webhook event and apply its effect exactly once.

    The unique ``razorpay_event_id`` is the idempotency key: ``get_or_create``
    either inserts a fresh ledger row (we then apply the effect) or finds an
    existing one (we no-op). Both Razorpay retries and the ``order.paid`` /
    ``payment.captured`` double-fire collapse to a single application.

    Returns ``True`` when this call newly applied the event, ``False`` when it
    was a duplicate / replay (no side effect).
    """
    with transaction.atomic():
        event, created = PaymentEvent.objects.get_or_create(
            razorpay_event_id=event_id,
            defaults={"kind": kind, "payload": payload},
        )
        if not created:
            return False

        invoice = _resolve_invoice(payload)
        if invoice is not None:
            event.invoice = invoice
            event.save(update_fields=["invoice"])
            if invoice.status != Invoice.Status.PAID:
                invoice.status = Invoice.Status.PAID
                invoice.paid_at = timezone.now()
                entity_id = payload.get("id")
                if isinstance(entity_id, str) and entity_id:
                    invoice.razorpay_id = entity_id
                invoice.save(update_fields=["status", "paid_at", "razorpay_id"])
        return True


def create_razorpay_order(amount_paise: int, receipt: str) -> dict[str, Any]:
    """Create a Razorpay order for ``amount_paise`` and return the parsed JSON.

    The amount is always supplied by the caller from the server-side invoice
    total — this function does not read any client input. The network call is
    isolated here (via module-level ``requests``) so tests can mock it.
    """
    key_id = getattr(settings, "RAZORPAY_KEY_ID", "") or ""
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "") or ""
    if not key_id or not key_secret:
        raise RazorpayConfigError("Razorpay API keys are not configured.")

    body = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": {"invoiceId": receipt},
    }
    response = requests.post(
        RAZORPAY_ORDERS_URL,
        json=body,
        auth=(key_id, key_secret),
        timeout=_ORDER_TIMEOUT_SECONDS,
    )
    if not 200 <= response.status_code < 300:
        raise RazorpayError(
            f"Razorpay order creation failed ({response.status_code})."
        )
    return response.json()
