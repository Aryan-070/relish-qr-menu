"""Floor-slice URL router: tables + service requests.

Mounted under ``api/ops/`` by ``ops.urls``, so the final routes are
``/api/ops/tables/`` and ``/api/ops/requests/`` (plus the standard detail and
custom-action sub-routes). No ``app_name`` here — the parent aggregator owns the
namespace.
"""
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from ops.floor_views import ServiceRequestViewSet, TableViewSet

router = DefaultRouter()
router.register("tables", TableViewSet, basename="table")
router.register("requests", ServiceRequestViewSet, basename="service-request")

urlpatterns = router.urls
