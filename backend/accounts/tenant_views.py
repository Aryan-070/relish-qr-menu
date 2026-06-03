"""Tenant lifecycle endpoints: self-serve org provisioning + tenant switch.

Both endpoints mint a *fresh* access/refresh pair so the JWT tenancy claims
(``membership_id`` / ``org_id`` / ``restaurant_id`` / ``role`` / ``perms``)
reflect the membership the caller just provisioned or switched into.
"""
from __future__ import annotations

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.constants import MEMBERSHIP_ACTIVE
from accounts.models import Membership
from accounts.serializers import (
    MembershipSummarySerializer,
    RelishTokenObtainPairSerializer,
)
from accounts.services.provisioning import provision_org
from accounts.tenant_serializers import (
    ProvisionOrgSerializer,
    TenantSwitchSerializer,
)


def _token_pair(token) -> dict[str, str]:
    """Serialize a refresh token + its access token into the standard pair."""
    return {"access": str(token.access_token), "refresh": str(token)}


class ProvisionOrgView(APIView):
    """POST: provision an org for the current user, return fresh scoped tokens.

    Idempotent — a user who already owns an active membership gets it back
    (still ``200``) without creating a duplicate org.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ProvisionOrgSerializer,
        responses={
            200: inline_serializer(
                name="TokenWithMembershipProvision",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "membership": MembershipSummarySerializer(),
                },
            )
        },
        tags=["accounts"],
    )
    def post(self, request):
        serializer = ProvisionOrgSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        membership = provision_org(
            user=request.user,
            org_name=data["org_name"],
            restaurant_name=data["restaurant_name"],
            city=data.get("city", ""),
        )

        token = RelishTokenObtainPairSerializer.token_for(request.user, membership)
        return Response(
            {
                **_token_pair(token),
                "membership": MembershipSummarySerializer(membership).data,
            },
            status=status.HTTP_200_OK,
        )


class TenantSwitchView(APIView):
    """POST: switch the active tenant to another membership the user owns.

    Returns a fresh token pair whose claims are scoped to the chosen membership.
    Unknown membership → ``404``; one the user does not own / inactive → ``403``.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=TenantSwitchSerializer,
        responses={
            200: inline_serializer(
                name="TokenWithMembershipSwitch",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "membership": MembershipSummarySerializer(),
                },
            )
        },
        tags=["accounts"],
    )
    def post(self, request):
        serializer = TenantSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership_id = serializer.validated_data["membership_id"]

        membership = (
            Membership.objects.select_related("org", "role")
            .filter(id=membership_id)
            .first()
        )
        if membership is None:
            raise NotFound("Membership not found.")
        if membership.user_id != request.user.id:
            raise PermissionDenied("This membership does not belong to you.")
        if not (membership.active and membership.status == MEMBERSHIP_ACTIVE):
            raise PermissionDenied("This membership is not active.")

        token = RelishTokenObtainPairSerializer.token_for(request.user, membership)
        return Response(
            {
                **_token_pair(token),
                "membership": MembershipSummarySerializer(membership).data,
            },
            status=status.HTTP_200_OK,
        )
