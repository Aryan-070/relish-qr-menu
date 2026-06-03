"""Serializers for the floor slice: tables + service requests.

Tenancy is enforced in the views, not here — the active ``restaurant_id`` is
stamped on create by the viewset, so these serializers never accept or expose
it as a writable field.

``TableSerializer`` carries the optimistic-concurrency token ``version``: it is
read-only on output but *accepted* on input so the view can compare the client's
token against the stored one before applying an update. ``SeatTableSerializer``
and ``CreateServiceRequestSerializer`` are thin write-only DTOs for the custom
``seat``/``create`` flows.
"""
from __future__ import annotations

from rest_framework import serializers

from ops.models import (
    REQUEST_TYPE_CHOICES,
    RestaurantTable,
    ServiceRequest,
)


class TableSerializer(serializers.ModelSerializer):
    """A floor table with every display field and the concurrency token.

    ``version`` is surfaced on output and accepted on input for optimistic
    concurrency; the view (not this serializer) compares and bumps it.
    """

    # Accepted on input but never mutated through ``serializer.save`` — the
    # view bumps it explicitly. Declared writable (not read-only) so a stale
    # token in the body is preserved for the view's comparison.
    version = serializers.IntegerField(required=False)

    class Meta:
        model = RestaurantTable
        fields = [
            "id",
            "code",
            "label",
            "seats",
            "zone",
            "status",
            "waiter_membership",
            "guests",
            "seated_at",
            "version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "seated_at", "created_at", "updated_at"]


class SeatTableSerializer(serializers.Serializer):
    """Write DTO for the ``seat/`` action: guests + optional waiter."""

    guests = serializers.IntegerField(min_value=0)
    waiter_membership_id = serializers.UUIDField(required=False, allow_null=True)
    version = serializers.IntegerField(required=False)


class ServiceRequestSerializer(serializers.ModelSerializer):
    """Read representation of a service request (call-waiter / bill / water …)."""

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "code",
            "table",
            "type",
            "status",
            "claimed_by_membership",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CreateServiceRequestSerializer(serializers.Serializer):
    """Write DTO for creating a service request from the floor/guest surface."""

    table_id = serializers.UUIDField()
    type = serializers.ChoiceField(choices=[c[0] for c in REQUEST_TYPE_CHOICES])
    note = serializers.CharField(
        max_length=300, required=False, allow_blank=True, default=""
    )
