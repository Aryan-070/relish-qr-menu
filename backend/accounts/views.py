from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.constants import MEMBERSHIP_ACTIVE
from accounts.serializers import (
    MembershipSummarySerializer,
    RelishTokenObtainPairSerializer,
)
from common.context import get_current_org_id


class RelishTokenObtainPairView(TokenObtainPairView):
    """Obtain an access/refresh pair with Relish tenancy claims attached.

    Accepts a ``username`` or recovery email as the login identifier (resolved by
    ``accounts.auth_backends.UsernameOrEmailBackend``). Self-registration is
    intentionally not offered -- accounts are created by an admin/manager.
    """

    serializer_class = RelishTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class MeView(APIView):
    """Return the authenticated user plus their active memberships.

    ``active`` is the membership matching the request's current org (resolved by
    the tenancy middleware from the JWT), falling back to the first membership.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: inline_serializer(
                name="MeResponse",
                fields={
                    "id": serializers.CharField(),
                    "username": serializers.CharField(),
                    "email": serializers.EmailField(allow_null=True),
                    "memberships": MembershipSummarySerializer(many=True),
                    "active": MembershipSummarySerializer(allow_null=True),
                },
            )
        },
        tags=["accounts"],
    )
    def get(self, request):
        user = request.user
        memberships = list(
            user.memberships.filter(status=MEMBERSHIP_ACTIVE, active=True)
            .select_related("org", "role")
            .prefetch_related("outlets__restaurant")
        )

        current_org_id = get_current_org_id()
        active = None
        if current_org_id is not None:
            active = next(
                (m for m in memberships if str(m.org_id) == str(current_org_id)),
                None,
            )
        if active is None and memberships:
            active = memberships[0]

        return Response(
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "memberships": MembershipSummarySerializer(
                    memberships, many=True
                ).data,
                "active": (
                    MembershipSummarySerializer(active).data
                    if active is not None
                    else None
                ),
            }
        )
