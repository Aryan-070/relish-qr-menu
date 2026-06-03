"""Request serializers for the tenant provisioning + switch endpoints."""
from __future__ import annotations

from rest_framework import serializers


class ProvisionOrgSerializer(serializers.Serializer):
    """Payload to stand up a new org + first outlet for the current user."""

    org_name = serializers.CharField(max_length=200)
    restaurant_name = serializers.CharField(max_length=200)
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)


class TenantSwitchSerializer(serializers.Serializer):
    """Payload to switch the active tenant to a membership the user owns."""

    membership_id = serializers.UUIDField()
