"""Billing model-validation tests.

Money fields are integer minor units (paise) and must never go negative — a
negative ``total_minor`` would mean we owe the customer money, which is always a
bug upstream. These tests pin the ``MinValueValidator(0)`` guard so a regression
that drops the validator is caught.
"""
from __future__ import annotations

import uuid

import pytest
from django.core.exceptions import ValidationError

from billing.models import Invoice, Subscription

pytestmark = pytest.mark.django_db


def _invoice(**overrides) -> Invoice:
    defaults = {
        "code": f"INV-{uuid.uuid4().hex[:8]}",
        "org_id": uuid.uuid4(),
        "base_minor": 1000,
        "gst_minor": 180,
        "total_minor": 1180,
    }
    defaults.update(overrides)
    return Invoice(**defaults)


@pytest.mark.parametrize("field", ["base_minor", "gst_minor", "total_minor"])
def test_invoice_rejects_negative_money(field):
    invoice = _invoice(**{field: -1})
    with pytest.raises(ValidationError) as exc:
        invoice.full_clean()
    assert field in exc.value.message_dict


def test_invoice_accepts_zero_and_positive_money():
    # Zero is valid (e.g. a fully-discounted line); full_clean must not raise.
    _invoice(base_minor=0, gst_minor=0, total_minor=0).full_clean()


def test_subscription_rejects_negative_gst_pct():
    sub = Subscription(
        org_id=uuid.uuid4(),
        package=Subscription.Package.CLASSIC,
        renewal_at="2030-01-01T00:00:00Z",
        gst_pct=-5,
    )
    with pytest.raises(ValidationError) as exc:
        sub.full_clean()
    assert "gst_pct" in exc.value.message_dict
