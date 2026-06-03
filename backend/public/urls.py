"""URL routes for the public guest menu app.

Mounted under ``/api/public/`` by ``config.urls``, so the menu endpoint resolves
to ``/api/public/menu/<uuid>/``.
"""
from __future__ import annotations

from django.urls import path

from .views import PublicMenuView

app_name = "public"

urlpatterns = [
    path(
        "menu/<uuid:restaurant_id>/",
        PublicMenuView.as_view(),
        name="public_menu",
    ),
]
