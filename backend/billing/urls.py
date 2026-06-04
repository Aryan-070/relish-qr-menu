"""URL routing for the billing slice (mounted under ``/api/billing/``)."""
from __future__ import annotations

from django.urls import path

from billing.views import CreateOrderView, RazorpayWebhookView

app_name = "billing"

urlpatterns = [
    path("webhook/", RazorpayWebhookView.as_view(), name="razorpay_webhook"),
    path("orders/", CreateOrderView.as_view(), name="create_order"),
]
