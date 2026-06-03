from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import MeView, RelishTokenObtainPairView, SignupView

app_name = "accounts"

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("token/", RelishTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
]
