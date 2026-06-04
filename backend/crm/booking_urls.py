"""Bookings + feedback URL router: reservations, waitlist, feedback.

Mounted under ``api/crm/`` by ``crm.urls``, so the final routes are
``/api/crm/reservations/``, ``/api/crm/waitlist/`` and ``/api/crm/feedback/``
(plus the standard detail and custom-action sub-routes). No ``app_name`` here —
the parent aggregator owns the namespace.
"""
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from crm.booking_views import (
    FeedbackViewSet,
    ReservationViewSet,
    WaitlistViewSet,
)

router = DefaultRouter()
router.register("reservations", ReservationViewSet, basename="reservation")
router.register("waitlist", WaitlistViewSet, basename="waitlist-entry")
router.register("feedback", FeedbackViewSet, basename="feedback")

urlpatterns = router.urls
