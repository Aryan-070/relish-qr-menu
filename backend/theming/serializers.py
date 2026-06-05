"""DRF serializers for the theming slice."""
from __future__ import annotations

import re
from typing import Any

from rest_framework import serializers

from theming.models import RestaurantTheme

_HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_COLOR_KEYS = {"primary", "secondary", "accent"}


class RestaurantThemeSerializer(serializers.ModelSerializer):
    """Full theme config. ``restaurant`` (the PK) is read-only."""

    class Meta:
        model = RestaurantTheme
        fields = (
            "restaurant",
            "ui_theme",
            "landing_variant",
            "component_style",
            "media_mode",
            "token_overrides",
            "brand_colors",
            "font_choices",
            "custom_font",
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

    def validate_brand_colors(self, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("brand_colors must be a JSON object.")
        for key, color in value.items():
            if key not in _COLOR_KEYS:
                raise serializers.ValidationError(
                    f"Unknown color key: {key!r}. Allowed: {sorted(_COLOR_KEYS)}."
                )
            if not isinstance(color, str) or not _HEX_COLOR.match(color):
                raise serializers.ValidationError(
                    f"{key} must be a hex color like #1a2b3c."
                )
        return value

    def validate_custom_font(self, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_font must be a JSON object.")
        if not value:
            return value
        name = value.get("name")
        url = value.get("url")
        if not name or not isinstance(name, str):
            raise serializers.ValidationError("custom_font.name is required.")
        if not url or not isinstance(url, str) or not url.startswith(("http://", "https://", "/")):
            raise serializers.ValidationError("custom_font.url must be a valid URL.")
        return value

    def validate_font_choices(self, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("font_choices must be a JSON object.")
        return value


class ThemeDraftSerializer(serializers.Serializer):
    """Validate a partial ``draft`` config — an arbitrary JSON object."""

    draft = serializers.JSONField()

    def validate_draft(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("draft must be a JSON object.")
        return value
