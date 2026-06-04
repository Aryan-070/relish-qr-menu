"""Serializers for the menu console CRUD surface.

These power the authenticated staff back-office (categories, items, modifier
groups/modifiers). Tenancy is enforced in the views, not here: the active
``restaurant_id`` is stamped on create by the viewset, so these serializers
never accept or expose it as a writable field.

``MenuItemSerializer`` carries the optimistic-concurrency token ``version``:
it is read-only on output but *accepted* on input so the view can compare the
client's token against the stored one before applying an update.
"""
from __future__ import annotations

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from menu.models import (
    MenuCategory,
    MenuItem,
    Modifier,
    ModifierGroup,
)


class ModifierSerializer(serializers.ModelSerializer):
    """A single selectable modifier option within a group."""

    class Meta:
        model = Modifier
        fields = ["id", "group", "label", "price_delta_minor"]
        read_only_fields = ["id"]


class ModifierGroupSerializer(serializers.ModelSerializer):
    """A modifier group with its options nested read-only."""

    modifiers = ModifierSerializer(many=True, read_only=True)

    class Meta:
        model = ModifierGroup
        fields = ["id", "name", "min_select", "max_select", "modifiers"]
        read_only_fields = ["id", "modifiers"]


class MenuCategorySerializer(serializers.ModelSerializer):
    """A menu category (section) belonging to the active restaurant."""

    class Meta:
        model = MenuCategory
        fields = ["id", "code", "name", "sort_order", "banner_url"]
        read_only_fields = ["id"]


class ModifierGroupRefSerializer(serializers.Serializer):
    """Lightweight ``{id, name}`` reference to a linked modifier group."""

    id = serializers.UUIDField()
    name = serializers.CharField()


class MenuItemSerializer(serializers.ModelSerializer):
    """A menu item with all display fields and the concurrency token.

    ``modifier_groups`` is summarised as a list of ``{id, name}`` objects (the
    groups linked to this item via ``MenuItemModifierGroup``). ``version`` is
    surfaced on output and accepted on input for optimistic concurrency; the
    view (not this serializer) compares and bumps it.
    """

    modifier_groups = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "category",
            "code",
            "name",
            "price_minor",
            "description",
            "tax_rate_pct",
            "tags",
            "badges",
            "is_jain",
            "can_be_jain",
            "chefs_special",
            "spice_level",
            "available",
            "sold_out",
            "image_url",
            "video_url",
            "nutrition",
            "version",
            "modifier_groups",
        ]
        read_only_fields = ["id", "version", "modifier_groups"]

    @extend_schema_field(ModifierGroupRefSerializer(many=True))
    def get_modifier_groups(self, obj: MenuItem) -> list[dict[str, object]]:
        """Return the linked modifier groups as ``[{id, name}, ...]``."""
        return [
            {"id": str(group.id), "name": group.name}
            for group in obj.modifier_groups.all()
        ]
