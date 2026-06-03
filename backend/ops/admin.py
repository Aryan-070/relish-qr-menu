from django.contrib import admin

from ops.models import (
    AuditLog,
    Order,
    OrderLine,
    OrderLineModifier,
    RestaurantTable,
    ServiceRequest,
)


@admin.register(RestaurantTable)
class RestaurantTableAdmin(admin.ModelAdmin):
    list_display = ("label", "code", "zone", "status", "guests", "waiter_membership")
    list_filter = ("zone", "status")


class OrderLineInline(admin.TabularInline):
    model = OrderLine
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("code", "status", "table", "total_minor", "paid", "voided", "comp")
    list_filter = ("status", "paid", "voided", "comp")
    inlines = [OrderLineInline]


@admin.register(OrderLineModifier)
class OrderLineModifierAdmin(admin.ModelAdmin):
    list_display = ("label", "price_delta_minor", "order_line")


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ("code", "type", "status", "table", "claimed_by_membership")
    list_filter = ("type", "status")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("type", "order", "actor_membership", "amount_minor", "created_at")
    list_filter = ("type",)
    readonly_fields = ("created_at", "updated_at")
