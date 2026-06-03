"""URL routes owned by the ``common`` app (mounted under ``/api/``)."""
from __future__ import annotations

from django.urls import path

from common.views import HealthView

app_name = "common"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
]
