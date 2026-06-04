"""URL routes for the orders slice (mounted under ``api/ops/``)."""
from __future__ import annotations

from django.urls import path

from ops.order_views import (
    OrderCompView,
    OrderDiscountView,
    OrderListCreateView,
    OrderStatusView,
    OrderVoidView,
)

urlpatterns = [
    path("orders/", OrderListCreateView.as_view(), name="orders"),
    path(
        "orders/<uuid:pk>/status/",
        OrderStatusView.as_view(),
        name="order-status",
    ),
    path("orders/<uuid:pk>/void/", OrderVoidView.as_view(), name="order-void"),
    path("orders/<uuid:pk>/comp/", OrderCompView.as_view(), name="order-comp"),
    path(
        "orders/<uuid:pk>/discount/",
        OrderDiscountView.as_view(),
        name="order-discount",
    ),
]
