"""URL routes for the dining-session slice (mounted under ``/api/dining/``)."""
from __future__ import annotations

from django.urls import path

from .views import (
    JoinView,
    SessionCloseView,
    SessionConfirmView,
    SessionContactView,
    SessionDetailView,
    SessionDisputeView,
    SessionListView,
    SessionOrderView,
    SessionPayView,
    SessionPromoteView,
    SessionRequestBillView,
    SessionSettleCashView,
)

app_name = "dining"

urlpatterns = [
    path("join/", JoinView.as_view(), name="join"),
    path("sessions/", SessionListView.as_view(), name="session-list"),
    path("sessions/<uuid:pk>/", SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<uuid:pk>/orders/", SessionOrderView.as_view(), name="session-orders"),
    path("sessions/<uuid:pk>/contact/", SessionContactView.as_view(), name="session-contact"),
    path("sessions/<uuid:pk>/promote/", SessionPromoteView.as_view(), name="session-promote"),
    path("sessions/<uuid:pk>/confirm/", SessionConfirmView.as_view(), name="session-confirm"),
    path("sessions/<uuid:pk>/request-bill/", SessionRequestBillView.as_view(), name="session-request-bill"),
    path("sessions/<uuid:pk>/pay/", SessionPayView.as_view(), name="session-pay"),
    path("sessions/<uuid:pk>/settle-cash/", SessionSettleCashView.as_view(), name="session-settle-cash"),
    path("sessions/<uuid:pk>/dispute/", SessionDisputeView.as_view(), name="session-dispute"),
    path("sessions/<uuid:pk>/close/", SessionCloseView.as_view(), name="session-close"),
]
