"""URL routing for the theming slice (mounted under ``/api/theme/``)."""
from __future__ import annotations

from django.urls import path

from theming.views import ThemeDraftView, ThemePublishView, ThemeView

app_name = "theming"

urlpatterns = [
    path("", ThemeView.as_view(), name="theme"),
    path("draft/", ThemeDraftView.as_view(), name="theme_draft"),
    path("publish/", ThemePublishView.as_view(), name="theme_publish"),
]
