"""URL routes owned by the ``common`` app (mounted under ``/api/``)."""
from __future__ import annotations

from django.urls import path

from common.views import HealthView, ReadinessView, SeedDemoView

app_name = "common"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("health/ready/", ReadinessView.as_view(), name="readiness"),
    path("admin/seed-demo/", SeedDemoView.as_view(), name="seed_demo"),
]
