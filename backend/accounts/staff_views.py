"""Staff-management endpoints (roster, invites, permissions, deactivation).

All authenticated routes are gated by ``HasPermission("manage-staff")`` and
scoped to the caller's active org (resolved from the JWT ``org_id`` claim via
``common.context.get_current_org_id``). Membership lookups 404 when the row
belongs to a different org, so the org boundary doubles as an authorization
boundary — a manager can never read or mutate another tenant's staff.
"""
from __future__ import annotations

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Membership, Organization, Role
from accounts.services.staff import (
    InviteError,
    accept_invite,
    deactivate_membership,
    invite_staff,
    set_membership_permissions,
)
from accounts.staff_serializers import (
    AcceptInviteSerializer,
    InviteStaffSerializer,
    MembershipSerializer,
    SetPermissionsSerializer,
    StaffUpdateSerializer,
)
from common.context import get_current_org_id
from common.permissions import HasPermission


def _current_org_or_404() -> Organization:
    """Return the caller's active organization, or 404 when none is bound."""
    org_id = get_current_org_id()
    if org_id is None:
        raise Http404("No active organization in token.")
    return get_object_or_404(Organization, id=org_id)


def _membership_in_org_or_404(pk, org: Organization) -> Membership:
    """Return membership ``pk`` within ``org``, excluding soft-deleted rows."""
    return get_object_or_404(
        Membership, id=pk, org=org, deleted_at__isnull=True
    )


def _membership_for_response(membership: Membership) -> Membership:
    """Re-fetch ``membership`` with role + outlets + overrides for serialization.

    Shared by the staff detail / deactivate / permissions endpoints so the
    response-shaping query (and its ``select_related``/``prefetch_related``) lives
    in exactly one place.
    """
    return (
        Membership.objects.select_related("role")
        .prefetch_related("outlets", "permission_overrides")
        .get(pk=membership.pk)
    )


def _caller_membership_id(request) -> str | None:
    """Return the acting membership id from the JWT ``membership_id`` claim."""
    auth = getattr(request, "auth", None)
    payload = getattr(auth, "payload", None)
    if not payload:
        return None
    return payload.get("membership_id")


class StaffListCreateView(APIView):
    """GET the org roster; POST a new staff invite."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=None,
        responses={200: MembershipSerializer(many=True)},
        tags=["accounts"],
    )
    def get(self, request):
        org = _current_org_or_404()
        memberships = (
            Membership.objects.filter(org=org, deleted_at__isnull=True)
            .select_related("role")
            .prefetch_related("outlets", "permission_overrides")
            .order_by("display_name", "email")
        )
        return Response(MembershipSerializer(memberships, many=True).data)

    @extend_schema(
        request=InviteStaffSerializer,
        responses={
            201: inline_serializer(
                name="StaffInviteResult",
                fields={
                    "id": serializers.CharField(),
                    "email": serializers.EmailField(),
                    "token": serializers.CharField(),
                    "membership_id": serializers.CharField(),
                    "status": serializers.CharField(),
                },
            )
        },
        tags=["accounts"],
    )
    def post(self, request):
        org = _current_org_or_404()
        serializer = InviteStaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invited_by = None
        caller_id = _caller_membership_id(request)
        if caller_id:
            invited_by = Membership.objects.filter(id=caller_id, org=org).first()

        try:
            invite = invite_staff(
                org=org,
                email=data["email"],
                role_key=data["role_key"],
                invited_by=invited_by,
                outlet_ids=[str(o) for o in data.get("outlet_ids", [])],
            )
        except InviteError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "id": str(invite.id),
                "email": invite.email,
                "token": invite.token,
                "membership_id": str(invite.membership_id),
                "status": invite.status,
            },
            status=status.HTTP_201_CREATED,
        )


class StaffDetailView(APIView):
    """PATCH a membership's role and/or active flag."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=StaffUpdateSerializer,
        responses={200: MembershipSerializer},
        tags=["accounts"],
    )
    def patch(self, request, pk):
        org = _current_org_or_404()
        membership = _membership_in_org_or_404(pk, org)
        serializer = StaffUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields: list[str] = []
        if "role_key" in data:
            role = Role.objects.filter(
                key=data["role_key"], org__isnull=True
            ).first()
            if role is None:
                raise ValidationError(
                    {"role_key": "Unknown system role."}
                )
            membership.role = role
            update_fields.append("role")
        if "active" in data:
            membership.active = data["active"]
            update_fields.append("active")
        if update_fields:
            update_fields.append("updated_at")
            membership.save(update_fields=update_fields)

        return Response(MembershipSerializer(_membership_for_response(membership)).data)


class StaffDeactivateView(APIView):
    """POST to suspend a membership."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=None,
        responses={200: MembershipSerializer},
        tags=["accounts"],
    )
    def post(self, request, pk):
        org = _current_org_or_404()
        membership = _membership_in_org_or_404(pk, org)
        deactivate_membership(membership)
        return Response(MembershipSerializer(_membership_for_response(membership)).data)


class StaffPermissionsView(APIView):
    """POST a per-member permission delta (add / revoke)."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=SetPermissionsSerializer,
        responses={200: MembershipSerializer},
        tags=["accounts"],
    )
    def post(self, request, pk):
        org = _current_org_or_404()
        membership = _membership_in_org_or_404(pk, org)
        serializer = SetPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        set_membership_permissions(
            membership,
            add=data.get("add", []),
            revoke=data.get("revoke", []),
        )
        return Response(MembershipSerializer(_membership_for_response(membership)).data)


class AcceptInviteView(APIView):
    """Public invite redemption: bind a user and activate the membership."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=AcceptInviteSerializer,
        responses={
            200: inline_serializer(
                name="AcceptInviteResult",
                fields={
                    "id": serializers.CharField(),
                    "status": serializers.CharField(),
                    "email": serializers.EmailField(),
                },
            )
        },
        auth=[],
        tags=["accounts"],
    )
    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            membership = accept_invite(
                token=data["token"], password=data["password"]
            )
        except InviteError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {
                "id": str(membership.id),
                "status": membership.status,
                "email": membership.email,
            },
            status=status.HTTP_200_OK,
        )
