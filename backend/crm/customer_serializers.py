"""Serializers for the customers + loyalty API surface.

``CustomerSerializer`` is read-shaped (the cached loyalty fields are
service-managed, never client-set). ``EnrollCustomerSerializer`` and
``PointsSerializer`` validate the two write actions (enroll, earn/redeem).
"""
from __future__ import annotations

from rest_framework import serializers

from crm.models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    """Read view of an org-scoped customer + their cached loyalty state."""

    class Meta:
        model = Customer
        fields = (
            "id",
            "name",
            "phone",
            "tier",
            "points",
            "visits",
            "lifetime_spend_minor",
            "tags",
            "last_visit",
            "joined_at",
        )
        read_only_fields = fields


class EnrollCustomerSerializer(serializers.Serializer):
    """Validate an enroll request: phone is required, name optional."""

    phone = serializers.CharField(max_length=20)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)


class PointsSerializer(serializers.Serializer):
    """Validate an earn/redeem request: positive points + optional order id."""

    points = serializers.IntegerField(min_value=1)
    order_id = serializers.UUIDField(required=False, allow_null=True)
