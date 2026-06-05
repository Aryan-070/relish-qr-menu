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
            "birth_date",
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
    """Validate an enroll request: phone required; name + birthday optional.

    Birthday is day+month only; ``validate`` folds them into a ``birth_date``
    (sentinel-year date) for the service layer.
    """

    phone = serializers.CharField(max_length=20)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    birth_day = serializers.IntegerField(min_value=1, max_value=31, required=False, allow_null=True)
    birth_month = serializers.IntegerField(min_value=1, max_value=12, required=False, allow_null=True)

    def validate(self, attrs):
        from crm.loyalty_services import birthday_date

        try:
            attrs["birth_date"] = birthday_date(attrs.get("birth_day"), attrs.get("birth_month"))
        except ValueError as exc:
            raise serializers.ValidationError({"birth_day": "Invalid birthday."}) from exc
        return attrs


class PointsSerializer(serializers.Serializer):
    """Validate an earn/redeem request: positive points + optional order id."""

    points = serializers.IntegerField(min_value=1)
    order_id = serializers.UUIDField(required=False, allow_null=True)
