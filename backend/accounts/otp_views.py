"""Passwordless OTP endpoints: request a code, verify it (and mint a JWT).

``OtpRequestView`` is anonymous and throttled (scope ``anon``) to blunt
enumeration / SMS-bombing. It returns only ``{"sent": true}`` — the raw code is
**never** echoed in the response; it is handed to the (stubbed) delivery channel
inside the service. ``OtpVerifyView`` checks the code and, for a successful
``login`` purpose tied to an existing user, returns a JWT pair.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.constants import OTP_LOGIN, OTP_PURPOSE_CHOICES
from accounts.serializers import RelishTokenObtainPairSerializer
from accounts.services.otp import request_otp, verify_otp
from common.schema import TokenPairSerializer

User = get_user_model()

_PURPOSE_CHOICES = [choice[0] for choice in OTP_PURPOSE_CHOICES]


class _OtpIdentifierSerializer(serializers.Serializer):
    """Shared base: a purpose plus exactly one of email / phone."""

    purpose = serializers.ChoiceField(choices=_PURPOSE_CHOICES)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError("Provide an email or phone.")
        return attrs


class OtpRequestSerializer(_OtpIdentifierSerializer):
    """Validate an OTP request."""


class OtpVerifySerializer(_OtpIdentifierSerializer):
    """Validate an OTP verification (adds the submitted code)."""

    code = serializers.CharField()


class OtpRequestView(APIView):
    """POST {purpose, email|phone} → issue a code (never returned in body)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "anon"

    @extend_schema(
        request=OtpRequestSerializer,
        responses={
            200: inline_serializer(
                name="OtpRequestResult",
                fields={"sent": serializers.BooleanField()},
            )
        },
        auth=[],
        tags=["accounts"],
    )
    def post(self, request):
        serializer = OtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # The raw code is discarded here (delivery is stubbed); it is never
        # placed in the response. TODO(Phase 4): send via email/SMS task.
        request_otp(
            purpose=data["purpose"],
            email=data.get("email", ""),
            phone=data.get("phone", ""),
        )
        return Response({"sent": True}, status=status.HTTP_200_OK)


class OtpVerifyView(APIView):
    """POST {purpose, email|phone, code} → verify; mint JWT for login users."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=OtpVerifySerializer,
        responses={
            200: OpenApiResponse(
                response=TokenPairSerializer,
                description=(
                    "Returns a JWT access/refresh pair on a successful "
                    "``login`` verification tied to an existing user; "
                    "otherwise returns ``{\"verified\": true}``."
                ),
            )
        },
        auth=[],
        tags=["accounts"],
    )
    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ok = verify_otp(
            purpose=data["purpose"],
            code=data["code"],
            email=data.get("email", ""),
            phone=data.get("phone", ""),
        )
        if not ok:
            return Response(
                {"detail": "Invalid or expired code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data["purpose"] == OTP_LOGIN and data.get("email"):
            user = User.objects.filter(email=data["email"]).first()
            if user is None:
                return Response(
                    {"detail": "No account for this email."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RelishTokenObtainPairSerializer.get_token(user)
            return Response(
                {
                    "access": str(token.access_token),
                    "refresh": str(token),
                },
                status=status.HTTP_200_OK,
            )

        return Response({"verified": True}, status=status.HTTP_200_OK)
