"""Ops URL aggregator. The floor and order slices each define their own
urlpatterns module (filled by Phase 5-ops agents)."""
from django.urls import include, path

app_name = "ops"

urlpatterns = [
    path("", include("ops.floor_urls")),
    path("", include("ops.order_urls")),
]
