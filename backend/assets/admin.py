from django.contrib import admin

from assets.models import AssetRendition, MediaAsset


class AssetRenditionInline(admin.TabularInline):
    model = AssetRendition
    extra = 0


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("kind", "owner_type", "owner_id", "status", "bytes", "created_at")
    list_filter = ("kind", "status", "owner_type")
    search_fields = ("key",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [AssetRenditionInline]
