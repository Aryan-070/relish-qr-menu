"""Django admin registration for the theming slice."""
from __future__ import annotations

from django.contrib import admin

from theming.models import RestaurantTheme


@admin.register(RestaurantTheme)
class RestaurantThemeAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "ui_theme", "component_style", "published")
    list_filter = ("ui_theme", "component_style", "media_mode", "published")
    search_fields = ("restaurant__name", "restaurant__code")
    readonly_fields = ("created_at", "updated_at")
