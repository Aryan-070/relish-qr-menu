"""Read-only serializers for the public, unauthenticated guest menu.

Every serializer here is a strict allowlist of *safe* display fields. They must
NEVER expose internal columns such as ``version``, ``deleted_at``,
``restaurant_id``, ``code``, ``tax_rate_pct``, timestamps, or any cost/margin
field. The diner is anonymous, so the safe-field contract is the only thing
standing between the kitchen's internals and the public internet.
"""
from __future__ import annotations

from rest_framework import serializers


class PublicModifierSerializer(serializers.Serializer):
    """A single selectable modifier (e.g. "Extra cheese")."""

    id = serializers.UUIDField(read_only=True)
    label = serializers.CharField(read_only=True)
    price_delta_minor = serializers.IntegerField(read_only=True)


class PublicModifierGroupSerializer(serializers.Serializer):
    """A group of modifiers with selection bounds (e.g. "Pick a size")."""

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    min_select = serializers.IntegerField(read_only=True)
    max_select = serializers.IntegerField(read_only=True)
    modifiers = PublicModifierSerializer(many=True, read_only=True)


class PublicMenuItemSerializer(serializers.Serializer):
    """A guest-facing menu item — safe display fields only."""

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    price_minor = serializers.IntegerField(read_only=True)
    description = serializers.CharField(read_only=True, allow_blank=True)
    tags = serializers.JSONField(read_only=True)
    badges = serializers.JSONField(read_only=True)
    is_jain = serializers.BooleanField(read_only=True)
    can_be_jain = serializers.BooleanField(read_only=True)
    chefs_special = serializers.BooleanField(read_only=True)
    spice_level = serializers.IntegerField(read_only=True)
    available = serializers.BooleanField(read_only=True)
    sold_out = serializers.BooleanField(read_only=True)
    image_url = serializers.CharField(read_only=True, allow_blank=True)
    video_url = serializers.CharField(read_only=True, allow_blank=True)
    nutrition = serializers.JSONField(read_only=True)
    modifier_groups = PublicModifierGroupSerializer(many=True, read_only=True)


class PublicCategorySerializer(serializers.Serializer):
    """A menu category with its available items."""

    id = serializers.UUIDField(read_only=True)
    code = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    sort_order = serializers.IntegerField(read_only=True)
    items = PublicMenuItemSerializer(many=True, read_only=True)
