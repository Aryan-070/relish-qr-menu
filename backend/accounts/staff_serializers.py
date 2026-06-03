"""Serializers for the staff-management API surface.

Read serializers (``MembershipSerializer``) shape the roster; write serializers
validate invite/accept/permission payloads at the boundary before any service
call. Role choices are derived from the seeded system roles so an unknown role
is rejected with a clean field error rather than a 500 deep in the service.
"""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.constants import PERMISSION_KEYS, ROLE_LABELS
from accounts.models import Membership


class MembershipSerializer(serializers.ModelSerializer):
    """Roster representation of a single membership."""

    role = serializers.CharField(source="role.key", read_only=True)
    perms = serializers.SerializerMethodField()
    outlets = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = [
            "id",
            "display_name",
            "email",
            "role",
            "status",
            "active",
            "perms",
            "outlets",
        ]
        read_only_fields = fields

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
