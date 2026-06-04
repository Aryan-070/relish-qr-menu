"""DRF serializers for the theming slice."""
from __future__ import annotations

from typing import Any

from rest_framework import serializers

from theming.models import RestaurantTheme


class RestaurantThemeSerializer(serializers.ModelSerializer):
    """Full theme config. ``restaurant`` (the PK) is read-only."""

    class Meta:
        model = RestaurantTheme
        fields = (
            "restaurant",
            "ui_theme",
            "component_style",
            "media_mode",
            "token_overrides",
            "allow_customer_choice",
            "customer_choices",
            "draft",
            "published",
            "logo_url",
            "cover_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "restaurant",
            "draft",
            "published",
            "created_at",
            "updated_at",
        )


class ThemeDraftSerializer(serializers.Serializer):
    """Validate a partial ``draft`` config — an arbitrary JSON object."""

    draft = serializers.JSONField()

    def validate_draft(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("draft must be a JSON object.")
        return value
