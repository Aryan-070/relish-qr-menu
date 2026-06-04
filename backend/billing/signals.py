"""Billing signals.

``payment_event_applied`` fires once, inside the webhook transaction, the first
time a Razorpay event is applied (never on replays). It carries the raw entity
``payload`` so other slices can settle their own domain object (e.g. the dining
``Check``) without ``billing`` taking a dependency on them — keeping the billing
slice ignorant of everything downstream.
"""
from __future__ import annotations

import django.dispatch

# kwargs: payload (dict) — the Razorpay order/payment entity.
payment_event_applied = django.dispatch.Signal()
