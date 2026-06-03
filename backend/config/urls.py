"""Root URL configuration.

App URL modules are owned by their respective apps (each a self-contained
slice). Phase 0 wires: health (common), auth (accounts), billing (Razorpay).
Phase 2+ adds public menu, menu/ops/CRM, media, etc.
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI schema + interactive docs.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # App routes.
    path("api/", include("common.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/billing/", include("billing.urls")),
    path("api/menu/", include("menu.urls")),
    path("api/theme/", include("theming.urls")),
    path("api/public/", include("public.urls")),
]
