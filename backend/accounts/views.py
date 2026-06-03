from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.serializers import (
    RelishTokenObtainPairSerializer,
    SignupSerializer,
    UserSerializer,
)


class SignupView(CreateAPIView):
    """Public endpoint to register a new account."""

    permission_classes = [AllowAny]
    serializer_class = SignupSerializer


class RelishTokenObtainPairView(TokenObtainPairView):
    """Obtain an access/refresh pair with Relish tenancy claims attached."""

    serializer_class = RelishTokenObtainPairSerializer


class MeView(RetrieveAPIView):
    """Return the currently authenticated user."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
