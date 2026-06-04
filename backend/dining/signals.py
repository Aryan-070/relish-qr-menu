"""Dining signal receivers.

Settle a dining Check when billing applies a paid Razorpay webhook. The
dependency points the right way (dining → billing); billing never imports
dining.
"""
from __future__ import annotations

from typing import Any

from django.dispatch import receiver

from billing.signals import payment_event_applied

from .payments import settle_check_from_payload


@receiver(payment_event_applied)
def _settle_check_on_payment(sender: Any, payload: dict, **kwargs: Any) -> None:
    settle_check_from_payload(payload)
