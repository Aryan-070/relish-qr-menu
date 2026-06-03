"""Serializers for the bookings + feedback slice.

Tenancy is enforced in the views, not here — the active ``restaurant_id`` is
stamped on create by the viewset, so these serializers never accept or expose
it as a writable field.

Each resource has a *read* serializer (full ``ModelSerializer`` representation)
and a thin *create* DTO that constrains the writable surface:

* ``ReservationSerializer`` / ``CreateReservationSerializer`` — ``status`` is
  read-only and defaults to ``booked``; create only accepts the booking inputs.
* ``WaitlistEntrySerializer`` / ``CreateWaitlistEntrySerializer`` — likewise,
  ``status`` defaults to ``waiting``.
* ``FeedbackSerializer`` — ``rating`` is validated to the inclusive 1..5 range
  (0 or 6 are rejected with a field error surfaced under ``detail``).
"""
from __future__ import annotations

from rest_framework import serializers

from crm.models import Feedback, Reservation, WaitlistEntry


class ReservationSerializer(serializers.ModelSerializer):
    """Full read representation of a reservation.

    ``status`` is read-only here: it starts at ``booked`` (the model default)
    and only advances through the dedicated transition actions on the view.
    """

    class Meta:
        model = Reservation
        fields = [
            "id",
            "customer",
            "name",
            "phone",
            "party_size",
            "at",
            "table_id",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]


class CreateReservationSerializer(serializers.ModelSerializer):
    """Write DTO for booking a reservation.

    Accepts the booking inputs only; ``status`` is never client-set (it defaults
    to ``booked`` on the model). ``party_size`` must be at least 1.
    """

    party_size = serializers.IntegerField(min_value=1)

    class Meta:
        model = Reservation
        fields = [
            "customer",
            "name",
            "phone",
            "party_size",
            "at",
            "table_id",
            "notes",
        ]
        extra_kwargs = {
            "customer": {"required": False, "allow_null": True},
            "table_id": {"required": False, "allow_null": True},
            "notes": {"required": False, "allow_blank": True},
        }


class WaitlistEntrySerializer(serializers.ModelSerializer):
    """Full read representation of a waitlist entry.

    ``status`` is read-only: it starts at ``waiting`` and advances only through
    the ``notify``/``seat``/``leave`` transition actions on the view.
    """

    class Meta:
        model = WaitlistEntry
        fields = [
            "id",
            "customer",
            "name",
            "phone",
            "party_size",
            "quoted_mins",
            "status",
            "added_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "added_at",
            "created_at",
            "updated_at",
        ]


class CreateWaitlistEntrySerializer(serializers.ModelSerializer):
    """Write DTO for adding a party to the waitlist.

    ``status`` defaults to ``waiting`` on the model; ``party_size`` must be at
    least 1. ``phone``/``quoted_mins``/``customer`` are optional.
    """

    party_size = serializers.IntegerField(min_value=1)

    class Meta:
        model = WaitlistEntry
        fields = [
            "customer",
            "name",
            "phone",
            "party_size",
            "quoted_mins",
        ]
        extra_kwargs = {
            "customer": {"required": False, "allow_null": True},
            "phone": {"required": False, "allow_blank": True},
            "quoted_mins": {"required": False},
        }


class FeedbackSerializer(serializers.ModelSerializer):
    """Read + write representation of a guest feedback row.

    ``rating`` is validated to the inclusive 1..5 range; values outside it (0 or
    6) raise a field error that the global handler surfaces under ``detail``.
    """

    rating = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Feedback
        fields = [
            "id",
            "order_id",
            "table_id",
            "rating",
            "comment",
            "routed_to_public",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "order_id": {"required": False, "allow_null": True},
            "table_id": {"required": False, "allow_null": True},
            "comment": {"required": False, "allow_blank": True},
            "routed_to_public": {"required": False},
        }
