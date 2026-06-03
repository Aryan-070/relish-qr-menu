from django.contrib import admin

from crm.models import (
    Customer,
    CustomerOutlet,
    Feedback,
    LoyaltyLedger,
    Reservation,
    WaitlistEntry,
)


class CustomerOutletInline(admin.TabularInline):
    model = CustomerOutlet
    extra = 0


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "tier", "points", "visits", "lifetime_spend_minor")
    list_filter = ("tier",)
    search_fields = ("name", "phone")
    inlines = [CustomerOutletInline]


@admin.register(LoyaltyLedger)
class LoyaltyLedgerAdmin(admin.ModelAdmin):
    list_display = ("customer", "points_delta", "reason", "created_at")
    list_filter = ("reason",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("name", "party_size", "at", "status", "table_id")
    list_filter = ("status",)
    search_fields = ("name", "phone")


@admin.register(WaitlistEntry)
class WaitlistEntryAdmin(admin.ModelAdmin):
    list_display = ("name", "party_size", "quoted_mins", "status", "added_at")
    list_filter = ("status",)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("rating", "routed_to_public", "table_id", "created_at")
    list_filter = ("rating", "routed_to_public")
