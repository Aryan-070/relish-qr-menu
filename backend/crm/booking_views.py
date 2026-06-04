"""DRF viewsets for the bookings + feedback slice.

Three tenant-scoped resources power the front-of-house book: reservations, the
walk-in waitlist, and guest feedback. Every viewset is tenant-scoped end to end:

* **Reads** go through ``Model.objects`` (the ``TenantManager``), which
  auto-filters to the active restaurant and excludes soft-deleted rows;
  ``get_queryset`` additionally pins ``restaurant_id`` belt-and-suspenders.
* **Writes** stamp ``restaurant_id = get_current_restaurant_id()`` on create.
* **Deletes** are soft (``instance.soft_delete()``).

Authorization: bookings are not in the gated permission set, so every endpoint
only requires an authenticated tenant member (``IsAuthenticated`` +
``IsTenantMember``).

``ReservationViewSet`` and ``WaitlistViewSet`` expose POST transition actions
that advance the row's lifecycle status (e.g. ``booked → seated``); the ``seat``
reservation action may additionally bind a ``table_id`` from the request body.
"""
from __future__ import annotations

from typing import Any

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.context import get_current_restaurant_id
from common.permissions import IsTenantMember
from crm.booking_serializers import (
    CreateReservationSerializer,
    CreateWaitlistEntrySerializer,
    FeedbackSerializer,
    ReservationSerializer,
    WaitlistEntrySerializer,
)
from crm.models import Feedback, Reservation, WaitlistEntry


def _coerce_table_id(data: Any) -> Any:
    """Pull a ``table_id`` out of a request body, or ``None`` when absent/blank."""
    raw = data.get("table_id") if hasattr(data, "get") else None
    return raw if raw not in (None, "") else None


class ReservationViewSet(viewsets.ModelViewSet):
    """Tenant-scoped CRUD for reservations, plus status-transition actions.

    Standard create/list/retrieve/update/destroy is inherited. The ``seat``,
    ``complete``, ``cancel`` and ``no_show`` actions advance ``status`` through
    the reservation lifecycle; ``seat`` may additionally set ``table_id`` from
    the request body.
    """

    queryset = Reservation.objects.all()
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_serializer_class(self):
        """Use the lean create DTO on write, the full serializer otherwise."""
        if self.action == "create":
            return CreateReservationSerializer
        return ReservationSerializer

    def get_queryset(self):
        """Active-tenant reservations only (manager excludes soft-deleted rows)."""
        return Reservation.objects.filter(restaurant_id=get_current_restaurant_id())

    def perform_create(self, serializer) -> None:
        """Stamp the active restaurant onto the new reservation."""
        serializer.save(restaurant_id=get_current_restaurant_id())

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()

    def create(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Create a reservation, returning the full representation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ReservationSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def _set_status(self, new_status: str) -> Response:
        """Persist a status transition and return the full representation."""
        reservation = self.get_object()
        reservation.status = new_status
        reservation.save(update_fields=["status", "updated_at"])
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def seat(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Seat a reservation: status='seated', optionally binding a table."""
        reservation = self.get_object()
        reservation.status = "seated"
        table_id = _coerce_table_id(request.data)
        update_fields = ["status", "updated_at"]
        if table_id is not None:
            reservation.table_id = table_id
            update_fields.append("table_id")
        reservation.save(update_fields=update_fields)
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def complete(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Mark a reservation completed (party has dined and left)."""
        return self._set_status("completed")

    @action(detail=True, methods=["post"])
    def cancel(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Cancel a reservation (guest called off)."""
        return self._set_status("cancelled")

    @action(detail=True, methods=["post"], url_path="no_show")
    def no_show(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Mark a reservation a no-show (party never arrived)."""
        return self._set_status("no-show")


class WaitlistViewSet(viewsets.ModelViewSet):
    """Tenant-scoped CRUD for the walk-in waitlist, plus transition actions.

    The ``notify``, ``seat`` and ``leave`` actions advance ``status`` through the
    waitlist lifecycle (waiting → notified → seated, or → left).
    """

    queryset = WaitlistEntry.objects.all()
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_serializer_class(self):
        """Use the lean create DTO on write, the full serializer otherwise."""
        if self.action == "create":
            return CreateWaitlistEntrySerializer
        return WaitlistEntrySerializer

    def get_queryset(self):
        """Active-tenant waitlist entries only (excludes soft-deleted rows)."""
        return WaitlistEntry.objects.filter(restaurant_id=get_current_restaurant_id())

    def perform_create(self, serializer) -> None:
        """Stamp the active restaurant onto the new waitlist entry."""
        serializer.save(restaurant_id=get_current_restaurant_id())

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()

    def create(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Add a party to the waitlist, returning the full representation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            WaitlistEntrySerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def _set_status(self, new_status: str) -> Response:
        """Persist a status transition and return the full representation."""
        entry = self.get_object()
        entry.status = new_status
        entry.save(update_fields=["status", "updated_at"])
        return Response(WaitlistEntrySerializer(entry).data)

    @action(detail=True, methods=["post"])
    def notify(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Notify a waiting party that their table is ready (→ notified)."""
        return self._set_status("notified")

    @action(detail=True, methods=["post"])
    def seat(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Seat a waitlisted party (→ seated)."""
        return self._set_status("seated")

    @action(detail=True, methods=["post"])
    def leave(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Record that a waiting party left without being seated (→ left)."""
        return self._set_status("left")


class FeedbackViewSet(viewsets.ModelViewSet):
    """Tenant-scoped feedback (create + list, newest first).

    Reads come back newest-first (the model's default ordering); writes stamp
    the active restaurant and deletes are soft.
    """

    serializer_class = FeedbackSerializer
    queryset = Feedback.objects.all()
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        """Active-tenant feedback, newest first."""
        return Feedback.objects.filter(
            restaurant_id=get_current_restaurant_id()
        ).order_by("-created_at")

    def perform_create(self, serializer) -> None:
        """Stamp the active restaurant onto the new feedback row."""
        serializer.save(restaurant_id=get_current_restaurant_id())

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()
