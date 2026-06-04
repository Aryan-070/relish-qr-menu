"""Django admin registrations for the menu domain.

Admin uses each model's default manager (``objects``, the ``TenantManager``);
with no tenant bound in an admin request it yields the unscoped — but
soft-deleted-excluding — queryset. List displays surface tenant + soft-delete
state so staff can audit rows across restaurants.
"""
from __future__ import annotations

from django.contrib import admin

from menu.models import (
    MenuCategory,
    MenuItem,
    Modifier,
    ModifierGroup,
)


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "sort_order", "restaurant_id", "deleted_at")
    list_filter = ("restaurant_id",)
    search_fields = ("name", "code")
    ordering = ("sort_order", "name")


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "category",
        "price_minor",
        "available",
        "sold_out",
        "version",
        "restaurant_id",
        "deleted_at",
    )
    list_filter = ("restaurant_id", "available", "sold_out", "category")
    search_fields = ("name", "code")
    list_select_related = ("category",)
    ordering = ("category", "name")


class ModifierInline(admin.TabularInline):
    model = Modifier
    extra = 0


@admin.register(ModifierGroup)
class ModifierGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "min_select", "max_select", "restaurant_id", "deleted_at")
    list_filter = ("restaurant_id",)
    search_fields = ("name",)
    inlines = [ModifierInline]


@admin.register(Modifier)
class ModifierAdmin(admin.ModelAdmin):
    list_display = ("label", "group", "price_delta_minor", "restaurant_id", "deleted_at")
    list_filter = ("restaurant_id",)
    search_fields = ("label",)
    list_select_related = ("group",)
