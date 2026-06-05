from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from accounts.models import (
    Invite,
    Membership,
    MembershipOutlet,
    MembershipPermission,
    Organization,
    Otp,
    Permission,
    Restaurant,
    Role,
    RolePermission,
    TenantShard,
    User,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Username-based admin for the custom user (email is optional/recovery)."""

    list_display = ("username", "email", "is_staff", "is_active", "date_joined")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email")
    ordering = ("username",)
    readonly_fields = ("date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        (_("Permissions"), {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            ),
        }),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )


class MembershipOutletInline(admin.TabularInline):
    model = MembershipOutlet
    extra = 0


class MembershipPermissionInline(admin.TabularInline):
    model = MembershipPermission
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "org", "code", "city", "published", "active")
    list_filter = ("published", "active")
    search_fields = ("name", "code", "city")


@admin.register(TenantShard)
class TenantShardAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "shard", "region", "connection_alias")
    list_filter = ("shard", "region")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "category")
    list_filter = ("category",)


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("label", "key", "org", "is_system")
    list_filter = ("is_system",)
    inlines = [RolePermissionInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("__str__", "org", "role", "status", "active")
    list_filter = ("status", "active", "role")
    search_fields = ("display_name", "email")
    inlines = [MembershipOutletInline, MembershipPermissionInline]


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ("email", "org", "role", "status", "created_at", "accepted_at")
    list_filter = ("status",)
    search_fields = ("email",)


@admin.register(Otp)
class OtpAdmin(admin.ModelAdmin):
    list_display = ("purpose", "email", "phone", "expires_at", "consumed")
    list_filter = ("purpose", "consumed")
