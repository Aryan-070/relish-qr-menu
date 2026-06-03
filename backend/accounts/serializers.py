from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.constants import MEMBERSHIP_ACTIVE

User = get_user_model()


def _active_membership(user):
    """Return the user's default active membership (or ``None``).

    "Default" is simply the first active membership; ``token_for`` lets callers
    (tenant switch) pick a specific one instead.
    """
    return (
        user.memberships.filter(status=MEMBERSHIP_ACTIVE, active=True)
        .select_related("org", "role")
        .first()
    )


def _primary_outlet(membership):
    """Return the membership's primary outlet, falling back to its first."""
    if membership is None:
        return None
    return (
        membership.outlets.filter(is_primary=True).select_related("restaurant").first()
        or membership.outlets.select_related("restaurant").first()
    )


class SignupSerializer(serializers.ModelSerializer):
    """Register a new account with email + password.

    Password is write-only and run through Django's configured password
    validators. The user is created through the manager so the password is
    hashed and the email normalized.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        validators=[validate_password],
    )

    class Meta:
        model = User
        fields = ["id", "email", "password"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )


class UserSerializer(serializers.ModelSerializer):
    """Read-only-ish representation of the authenticated user."""

    class Meta:
        model = User
        fields = ["id", "email", "date_joined", "is_staff"]
        read_only_fields = fields


class MembershipSummarySerializer(serializers.Serializer):
    """Flat view of one active membership + its primary outlet.

    Used by ``MeView`` (the user's membership list) and by the provision /
    tenant-switch responses so the client can render org/outlet context without
    a second round-trip.
    """

    membership_id = serializers.SerializerMethodField()
    org_id = serializers.SerializerMethodField()
    org_name = serializers.SerializerMethodField()
    restaurant_id = serializers.SerializerMethodField()
    restaurant_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    perms = serializers.SerializerMethodField()

    def get_membership_id(self, membership) -> str:
        return str(membership.id)

    def get_org_id(self, membership) -> str:
        return str(membership.org_id)

    def get_org_name(self, membership) -> str:
        return membership.org.name

    def get_restaurant_id(self, membership) -> str | None:
        outlet = _primary_outlet(membership)
        return str(outlet.restaurant_id) if outlet else None

    def get_restaurant_name(self, membership) -> str | None:
        outlet = _primary_outlet(membership)
        return outlet.restaurant.name if outlet else None

    def get_role(self, membership) -> str | None:
        return membership.role.key if membership.role_id else None

    def get_perms(self, membership) -> list[str]:
        return sorted(membership.effective_permission_keys())


class RelishTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT serializer that attaches the tenancy claims contract.

    The access token carries, derived from the user's active membership:
    ``membership_id``, ``org_id``, ``restaurant_id`` (the primary outlet), the
    ``role`` key, and the sorted ``perms`` list. These are read by the tenancy
    middleware (``common.middleware``) to scope each request.

    A user with no active membership gets ``None`` ids/role and ``[]`` perms.
    """

    @classmethod
    def _apply_claims(cls, token, membership):
        """Populate the tenancy claims on ``token`` from ``membership``."""
        if membership is None:
            token["membership_id"] = None
            token["org_id"] = None
            token["restaurant_id"] = None
            token["role"] = None
            token["perms"] = []
            return token

        outlet = _primary_outlet(membership)
        token["membership_id"] = str(membership.id)
        token["org_id"] = str(membership.org_id)
        token["restaurant_id"] = str(outlet.restaurant_id) if outlet else None
        token["role"] = membership.role.key if membership.role_id else None
        token["perms"] = sorted(membership.effective_permission_keys())
        return token

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return cls._apply_claims(token, _active_membership(user))

    @classmethod
    def token_for(cls, user, membership):
        """Mint a token whose claims are scoped to a specific ``membership``.

        Used by the tenant-switch flow, which must scope to the chosen
        membership rather than the default ``get_token`` picks.
        """
        token = super().get_token(user)
        return cls._apply_claims(token, membership)
