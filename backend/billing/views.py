"""Billing API views: the Razorpay webhook receiver and the order-create endpoint.

Both endpoints concentrate the security-critical logic of the slice and are
deliberately small wrappers around :mod:`billing.services`.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from billing.models import Invoice
from billing.serializers import CreateOrderSerializer
from billing.services import (
    RazorpayConfigError,
    RazorpayError,
    create_razorpay_order,
    record_and_apply_event,
    verify_webhook_signature,
)
from common.context import get_current_org_id

logger = logging.getLogger(__name__)

_SIGNATURE_HEADER = "HTTP_X_RAZORPAY_SIGNATURE"


def _extract_event_id(body: dict[str, Any]) -> str:
    """Derive a stable idempotency key from a Razorpay webhook envelope.

    Razorpay does not always send a top-level event id, so we prefer the payment
    entity id, fall back to a top-level ``id``, and finally compose one from the
    event name plus the order entity id. The exact source does not matter as long
    as the same logical event maps to the same key across retries.
    """
    payload = body.get("payload")
    if isinstance(payload, dict):
        payment = payload.get("payment")
        if isinstance(payment, dict):
            entity = payment.get("entity")
            if isinstance(entity, dict) and entity.get("id"):
                return str(entity["id"])
        order = payload.get("order")
        if isinstance(order, dict):
            entity = order.get("entity")
            if isinstance(entity, dict) and entity.get("id"):
                return f"{body.get('event', 'event')}:{entity['id']}"

    if body.get("id"):
        return str(body["id"])
    return f"{body.get('event', 'event')}:{body.get('created_at', '')}"


def _extract_inner_entity(body: dict[str, Any]) -> dict[str, Any]:
    """Return the most relevant entity dict (order, then payment) for invoice
    resolution. Falls back to an empty dict when the shape is unexpected."""
    payload = body.get("payload")
    if isinstance(payload, dict):
        for key in ("order", "payment"):
            section = payload.get(key)
            if isinstance(section, dict):
                entity = section.get("entity")
                if isinstance(entity, dict):
                    return entity
    return {}


class RazorpayWebhookView(APIView):
    """Receive Razorpay webhooks: verify signature, then idempotently apply.

    Authentication is intentionally disabled — the HMAC signature over the raw
    body is the authentication. On a valid signature we return 200 once the event
    is durably applied (duplicates included, so Razorpay stops retrying); an
    invalid signature or malformed body yields a 400. An unexpected failure while
    applying the (atomic) event yields a 500 so Razorpay retries and re-applies
    cleanly — we never swallow it into a false 200.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses=inline_serializer(
            "WebhookAck", {"received": serializers.BooleanField()}
        ),
        auth=[],
        tags=["billing"],
    )
    def post(self, request: Request) -> Response:
        # Read the raw bytes FIRST — this is the exact payload the signature was
        # computed over. Accessing request.body before request.data avoids any
        # stream-consumption surprises.
        raw_body = request.body
        signature = request.META.get(_SIGNATURE_HEADER, "")

        if not verify_webhook_signature(raw_body, signature):
            return Response(
                {"detail": "Invalid signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            body = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"detail": "Malformed JSON body."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(body, dict):
            return Response(
                {"detail": "Malformed webhook envelope."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Signature is valid past this point. Envelope parsing is total (the
        # extractors fall back rather than raise), so the only thing that can
        # fail here is the durable apply. We deliberately do NOT swallow that:
        # ``record_and_apply_event`` is fully atomic, so an unexpected failure
        # rolls back the idempotency ledger row entirely. Letting it propagate
        # (DRF → 500) makes Razorpay retry — which then re-applies cleanly —
        # and surfaces the bug in Sentry, instead of silently dropping a real
        # payment under a blanket ``except``.
        event_id = _extract_event_id(body)
        kind = str(body.get("event", ""))
        entity = _extract_inner_entity(body)
        record_and_apply_event(event_id, kind, entity)

        return Response({"received": True}, status=status.HTTP_200_OK)


class CreateOrderView(APIView):
    """Create a Razorpay order for an invoice owned by the caller's org.

    Ownership is enforced against the active org bound by ``TenantMiddleware``
    and the charge amount is taken from ``invoice.total_minor`` — never from the
    request body.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "razorpay_order"

    @extend_schema(
        request=CreateOrderSerializer,
        responses=inline_serializer(
            "CreateOrderResult",
            {
                "order_id": serializers.CharField(),
                "amount": serializers.IntegerField(),
                "currency": serializers.CharField(),
            },
        ),
        tags=["billing"],
    )
    def post(self, request: Request) -> Response:
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice_id = serializer.validated_data["invoice_id"]

        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            return Response(
                {"detail": "Invoice not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_org = get_current_org_id()
        if current_org is None or str(invoice.org_id) != current_org:
            return Response(
                {"detail": "You do not have access to this invoice."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Amount is server-derived from the invoice total, never client input.
        amount_paise = invoice.total_minor
        try:
            order = create_razorpay_order(amount_paise, invoice.code)
        except (RazorpayConfigError, RazorpayError):
            logger.exception("Razorpay order creation failed for %s", invoice.code)
            return Response(
                {"detail": "Unable to create payment order."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "order_id": order.get("id"),
                "amount": invoice.total_minor,
                "currency": "INR",
            },
            status=status.HTTP_200_OK,
        )
