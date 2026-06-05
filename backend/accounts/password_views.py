"""Password-change-with-approval endpoints.

- ``request/``                 any tenant member opens a request for themselves
- ``requests/``                admins/managers list pending requests (their org)
- ``requests/<id>/approve/``   admins/managers approve (applies the new password)
- ``requests/<id>/reject/``    admins/managers reject

All approver routes are gated by ``HasPermission("manage-staff")`` and scoped to
the caller's org, so the org boundary doubles as the authorization boundary.
"""
from __future__ import annotations

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization, PasswordChangeRequest
from accounts.services.password import (
    approve_password_change,
    reject_password_change,
    request_password_change,
)
from accounts.services.staff import StaffError
from accounts.staff_serializers import (
    PasswordChangeRequestReadSerializer,
    PasswordChangeRequestSerializer,
    PasswordRejectSerializer,
)
from accounts.staff_views import _caller_membership, _current_org_or_404
from common.permissions import HasPermission


class PasswordChangeRequestView(APIView):
    """POST: open a self-service password-change request."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=PasswordChangeRequestSerializer,
        responses={201: PasswordChangeRequestReadSerializer},
        tags=["accounts"],
    )
    def post(self, request):
        org = _current_org_or_404()
        membership = _caller_membership(request, org)
        if membership is None:
            raise Http404("No membership bound to this token.")
        serializer = PasswordChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pcr = request_password_change(
                membership=membership,
                new_password=serializer.validated_data["new_password"],
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            PasswordChangeRequestReadSerializer(pcr).data,
            status=status.HTTP_201_CREATED,
        )


class PasswordRequestListView(APIView):
    """GET: list pending password-change requests in the caller's org."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=None,
        responses={200: PasswordChangeRequestReadSerializer(many=True)},
        tags=["accounts"],
    )
    def get(self, request):
        org = _current_org_or_404()
        pending = (
            PasswordChangeRequest.objects.filter(org=org, status="pending")
            .select_related("requester", "requester__user")
            .order_by("created_at")
        )
        return Response(
            PasswordChangeRequestReadSerializer(pending, many=True).data
        )


def _request_in_org_or_404(pk, org: Organization) -> PasswordChangeRequest:
    return get_object_or_404(PasswordChangeRequest, id=pk, org=org)


class PasswordApproveView(APIView):
    """POST: approve a pending request (applies the new password)."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=None,
        responses={200: PasswordChangeRequestReadSerializer},
        tags=["accounts"],
    )
    def post(self, request, pk):
        org = _current_org_or_404()
        pcr = _request_in_org_or_404(pk, org)
        try:
            approve_password_change(
                pcr=pcr, reviewer_membership=_caller_membership(request, org)
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PasswordChangeRequestReadSerializer(pcr).data)


class PasswordRejectView(APIView):
    """POST: reject a pending request."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=PasswordRejectSerializer,
        responses={200: PasswordChangeRequestReadSerializer},
        tags=["accounts"],
    )
    def post(self, request, pk):
        org = _current_org_or_404()
        pcr = _request_in_org_or_404(pk, org)
        serializer = PasswordRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reject_password_change(
                pcr=pcr,
                reviewer_membership=_caller_membership(request, org),
                reason=serializer.validated_data.get("reason", ""),
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PasswordChangeRequestReadSerializer(pcr).data)
