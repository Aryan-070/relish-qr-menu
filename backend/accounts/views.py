from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.constants import MEMBERSHIP_ACTIVE
from accounts.serializers import (
    MembershipSummarySerializer,
    RelishTokenObtainPairSerializer,
    SignupSerializer,
)
from common.context import get_current_org_id


class SignupView(CreateAPIView):
    """Public endpoint to register a new account."""

    permission_classes = [AllowAny]
    serializer_class = SignupSerializer


class RelishTokenObtainPairView(TokenObtainPairView):
    """Obtain an access/refresh pair with Relish tenancy claims attached."""

    serializer_class = RelishTokenObtainPairSerializer


class MeView(APIView):
    """Return the authenticated user plus their active memberships.

    ``active`` is the membership matching the request's current org (resolved by
    the tenancy middleware from the JWT), falling back to the first membership.
    """

    permission_classes = [IsAuthenticated]

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
