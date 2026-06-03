from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


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


class RelishTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT serializer that attaches forward-compatible tenancy claims.

    Phase 0: the multi-tenant model does not exist yet, so the claims are
    emitted as ``None`` placeholders. They are read by the tenancy middleware
    (``common.middleware``) to scope requests.

    Phase 1: populate ``membership_id`` / ``restaurant_id`` / ``org_id`` from
    the user's active ``Membership`` (selected default or last-used) instead
    of hard-coding ``None`` here.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Placeholders -- replaced by real membership context in Phase 1.
        token["membership_id"] = None
        token["restaurant_id"] = None
        token["org_id"] = None
        return token
