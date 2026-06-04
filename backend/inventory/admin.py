from django.contrib import admin

from inventory.models import (
    Ingredient,
    Promo,
    PurchaseOrder,
    PurchaseOrderLine,
    Recipe,
    RecipeLine,
    StockMovement,
    Supplier,
    Wastage,
)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email")
    search_fields = ("name",)


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("name", "unit", "stock", "low_threshold", "cost_per_unit_minor")
    search_fields = ("name",)


class RecipeLineInline(admin.TabularInline):
    model = RecipeLine
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ("menu_item",)
    inlines = [RecipeLineInline]


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("code", "supplier", "status", "received_at")
    list_filter = ("status",)
    inlines = [PurchaseOrderLineInline]


@admin.register(Wastage)
class WastageAdmin(admin.ModelAdmin):
    list_display = ("ingredient", "qty", "reason", "created_at")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("ingredient", "delta", "reason", "ref_id", "created_at")
    list_filter = ("reason",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Promo)
class PromoAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "kind", "value", "active")
    list_filter = ("kind", "active")
