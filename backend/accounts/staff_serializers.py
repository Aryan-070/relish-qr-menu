"""Serializers for the staff-management API surface.

Read serializers (``MembershipSerializer``) shape the roster; write serializers
validate invite/accept/permission payloads at the boundary before any service
call. Role choices are derived from the seeded system roles so an unknown role
is rejected with a clean field error rather than a 500 deep in the service.
"""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from rest_framework import serializers

from accounts.constants import PERMISSION_KEYS, ROLE_LABELS
from accounts.models import Membership, PasswordChangeRequest


class MembershipSerializer(serializers.ModelSerializer):
    """Roster representation of a single membership."""

    role = serializers.CharField(source="role.key", read_only=True)
    username = serializers.SerializerMethodField()
    perms = serializers.SerializerMethodField()
    outlets = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            "id",
            "display_name",
            "username",
            "email",
            "role",
            "status",
            "active",
            "perms",
            "outlets",
        ]
        read_only_fields = fields

    def get_username(self, obj: Membership) -> str | None:
        return obj.user.username if obj.user_id else None

    def get_perms(self, obj: Membership) -> list[str]:
        return sorted(obj.effective_permission_keys())

    def get_outlets(self, obj: Membership) -> list[dict]:
        return [
            {
                "restaurant_id": str(link.restaurant_id),
                "is_primary": link.is_primary,
            }
            for link in obj.outlets.all()
        ]


class InviteStaffSerializer(serializers.Serializer):
    """Validate an invite request."""

    email = serializers.EmailField()
    role_key = serializers.ChoiceField(choices=sorted(ROLE_LABELS.keys()))
    outlet_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class AcceptInviteSerializer(serializers.Serializer):
    """Validate an invite redemption (token + new password)."""

    token = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )


class SetPermissionsSerializer(serializers.Serializer):
    """Validate a per-member permission delta."""

    add = serializers.ListField(
        child=serializers.ChoiceField(choices=list(PERMISSION_KEYS)),
        required=False,
        default=list,
    )
    revoke = serializers.ListField(
        child=serializers.ChoiceField(choices=list(PERMISSION_KEYS)),
        required=False,
        default=list,
    )


class StaffUpdateSerializer(serializers.Serializer):
    """Validate a PATCH to a membership (role and/or active flag)."""

    role_key = serializers.ChoiceField(
        choices=sorted(ROLE_LABELS.keys()), required=False
    )
    active = serializers.BooleanField(required=False)


class StaffCreateSerializer(serializers.Serializer):
    """Validate a direct staff-account creation (username + password)."""

    username = serializers.CharField(
        max_length=150, validators=[UnicodeUsernameValidator()]
    )
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )
    display_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    role_key = serializers.ChoiceField(choices=sorted(ROLE_LABELS.keys()))
    outlet_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")


class AdminResetPasswordSerializer(serializers.Serializer):
    """Validate an admin/manager-initiated password reset (no approval)."""

    new_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )


class PasswordChangeRequestSerializer(serializers.Serializer):
    """Validate a self-service password-change request."""

    new_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )


class PasswordRejectSerializer(serializers.Serializer):
    """Optional reviewer note when rejecting a request."""

    reason = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )


class PasswordChangeRequestReadSerializer(serializers.ModelSerializer):
    """Roster-safe view of a password-change request (never exposes the hash)."""

    requester_name = serializers.CharField(
        source="requester.display_name", read_only=True
    )
    requester_username = serializers.SerializerMethodField()

    class Meta:
        model = PasswordChangeRequest
        fields = [
            "id",
            "requester",
            "requester_name",
            "requester_username",
            "status",
            "reason",
            "created_at",
            "reviewed_at",
        ]
        read_only_fields = fields

    def get_requester_username(self, obj: PasswordChangeRequest) -> str | None:
        user = obj.requester.user if obj.requester_id else None
        return user.username if user else None
