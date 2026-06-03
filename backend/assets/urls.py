"""Media-asset API routes (mounted under ``/api/media/`` by ``config.urls``).

Final shape:

* ``POST /api/media/presign/`` — request a presigned upload URL.
* ``POST /api/media/<uuid>/complete/`` — confirm a finished upload.
* ``/api/media/assets/`` — list / retrieve / soft-delete (router-generated).
"""
from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from assets.views import CompleteUploadView, MediaAssetViewSet, PresignView

app_name = "assets"

router = DefaultRouter()
router.register("assets", MediaAssetViewSet, basename="asset")

urlpatterns = [
    path("presign/", PresignView.as_view(), name="presign"),
    path("<uuid:pk>/complete/", CompleteUploadView.as_view(), name="complete"),
    *router.urls,
]
