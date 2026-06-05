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
from accounts.services.password import admin_reset_password
from accounts.services.staff import (
    InviteError,
    StaffError,
    accept_invite,
    assert_can_assign_role,
    assert_not_last_admin,
    create_staff_account,
    deactivate_membership,
    invite_staff,
    set_membership_permissions,
)
from accounts.staff_serializers import (
    AcceptInviteSerializer,
    AdminResetPasswordSerializer,
    InviteStaffSerializer,
    MembershipSerializer,
    SetPermissionsSerializer,
    StaffCreateSerializer,
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


def _caller_role_key(request) -> str | None:
    """Return the acting member's role key from the JWT ``role`` claim."""
    auth = getattr(request, "auth", None)
    payload = getattr(auth, "payload", None)
    if not payload:
        return None
    return payload.get("role")


def _caller_membership(request, org: Organization) -> Membership | None:
    """Resolve the acting membership row within ``org`` (for audit/reviewer)."""
    caller_id = _caller_membership_id(request)
    if not caller_id:
        return None
    return Membership.objects.filter(id=caller_id, org=org).first()


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


class StaffCreateAccountView(APIView):
    """POST a login-ready staff member directly (username + password).

    Admins may create any role; managers may create every non-admin role. This
    is the no-self-registration path -- an admin or manager provisions the
    account and hands over the credentials.
    """

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=StaffCreateSerializer,
        responses={201: MembershipSerializer},
        tags=["accounts"],
    )
    def post(self, request):
        org = _current_org_or_404()
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            membership = create_staff_account(
                org=org,
                username=data["username"],
                password=data["password"],
                display_name=data.get("display_name", ""),
                role_key=data["role_key"],
                outlet_ids=[str(o) for o in data.get("outlet_ids", [])],
                email=data.get("email", ""),
                caller_role_key=_caller_role_key(request),
                caller_is_superuser=request.user.is_superuser,
            )
        except StaffError as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            MembershipSerializer(_membership_for_response(membership)).data,
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

        caller_role = _caller_role_key(request)
        is_super = request.user.is_superuser
        # A manager may only act on non-admin members.
        try:
            assert_can_assign_role(
                caller_role,
                membership.role.key if membership.role_id else "",
                is_superuser=is_super,
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        update_fields: list[str] = []
        old_role_key: str | None = None
        if "role_key" in data:
            role = Role.objects.filter(
                key=data["role_key"], org__isnull=True
            ).first()
            if role is None:
                raise ValidationError(
                    {"role_key": "Unknown system role."}
                )
            try:
                assert_can_assign_role(
                    caller_role, data["role_key"], is_superuser=is_super
                )
                # Demoting an admin away from admin must not strip the last one.
                if (
                    membership.role_id
                    and membership.role.key == "admin"
                    and data["role_key"] != "admin"
                ):
                    assert_not_last_admin(org, membership)
            except StaffError as exc:
                return Response(
                    {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
                )
            old_role_key = membership.role.key if membership.role_id else None
            membership.role = role
            update_fields.append("role")
        if "active" in data:
            if data["active"] is False:
                try:
                    assert_not_last_admin(org, membership)
                except StaffError as exc:
                    return Response(
                        {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
                    )
            membership.active = data["active"]
            update_fields.append("active")
        if update_fields:
            update_fields.append("updated_at")
            membership.save(update_fields=update_fields)
            if old_role_key is not None and old_role_key != data["role_key"]:
                _audit_role_change(
                    request, membership, old_role_key, data["role_key"]
                )

        return Response(MembershipSerializer(_membership_for_response(membership)).data)


def _audit_role_change(request, membership, before_role, after_role) -> None:
    """Best-effort ``role-change`` audit row, scoped to the caller's restaurant.

    Skips silently when no restaurant is bound in the token (role changes are
    org-level; AuditLog is restaurant-scoped) so an audit gap never blocks the
    operation.
    """
    from common.context import get_current_restaurant_id

    restaurant_id = get_current_restaurant_id()
    if not restaurant_id:
        return
    from ops.models import AuditLog

    AuditLog.objects.create(
        restaurant_id=restaurant_id,
        type="role-change",
        actor_membership_id=getattr(request, "membership_id", None),
        before={"role": before_role},
        after={"role": after_role},
        reason=f"membership:{membership.id}",
    )


class AdminResetPasswordView(APIView):
    """POST a direct password reset for a member (no approval workflow)."""

    permission_classes = [IsAuthenticated, HasPermission("manage-staff")]

    @extend_schema(
        request=AdminResetPasswordSerializer,
        responses={200: inline_serializer(
            name="AdminResetPasswordResult",
            fields={"status": serializers.CharField()},
        )},
        tags=["accounts"],
    )
    def post(self, request, pk):
        org = _current_org_or_404()
        membership = _membership_in_org_or_404(pk, org)
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            admin_reset_password(
                target_membership=membership,
                new_password=serializer.validated_data["new_password"],
                reviewer_membership=_caller_membership(request, org),
                caller_role_key=_caller_role_key(request),
                caller_is_superuser=request.user.is_superuser,
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "reset"})


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
        try:
            assert_can_assign_role(
                _caller_role_key(request),
                membership.role.key if membership.role_id else "",
                is_superuser=request.user.is_superuser,
            )
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        try:
            assert_not_last_admin(org, membership)
        except StaffError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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
