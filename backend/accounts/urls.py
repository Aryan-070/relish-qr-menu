from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import MeView, RelishTokenObtainPairView, SignupView

app_name = "accounts"

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("token/", RelishTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    # Filled by Phase 1 agents (each module defines its own urlpatterns):
    path("", include("accounts.tenant_urls")),  # tenant switch / org provisioning
    path("staff/", include("accounts.staff_urls")),  # staff CRUD + invites
    path("otp/", include("accounts.otp_urls")),  # passwordless OTP login
]
