"""Passwordless OTP routes (mounted under ``accounts/otp/``)."""
from __future__ import annotations

from django.urls import path

from accounts.otp_views import OtpRequestView, OtpVerifyView

urlpatterns = [
    path("request/", OtpRequestView.as_view(), name="otp_request"),
    path("verify/", OtpVerifyView.as_view(), name="otp_verify"),
]
