"""Media assets: object-storage-backed images and videos with responsive
renditions. Replaces the demo's base64 data-URLs.

An asset records WHERE the bytes live (bucket + key in S3/Cloudflare R2), never
the bytes themselves. Images are served via on-the-fly CDN transforms; videos
are transcoded (Celery + ffmpeg) into 1080/720/360 renditions + a poster, with
``status`` tracking the pipeline. Tenant-scoped; ``owner_type``/``owner_id`` is a
soft polymorphic link to a menu item / category / restaurant.
"""
from django.db import models

from common.models import TenantScopedModel

KIND_CHOICES = (
    ("image", "Image"),
    ("video", "Video"),
    ("logo", "Logo"),
    ("cover", "Cover"),
    ("banner", "Banner"),
)
OWNER_TYPE_CHOICES = (
    ("menu_item", "Menu item"),
    ("category", "Category"),
    ("restaurant", "Restaurant"),
)
STATUS_CHOICES = (
    ("pending", "Pending upload"),
    ("processing", "Processing"),
    ("ready", "Ready"),
    ("failed", "Failed"),
)


class MediaAsset(TenantScopedModel):
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    owner_type = models.CharField(
        max_length=16, choices=OWNER_TYPE_CHOICES, blank=True
    )
    owner_id = models.UUIDField(null=True, blank=True)
    bucket = models.CharField(max_length=120)
    key = models.CharField(max_length=500, help_text="Object-storage key (NOT a data-URL).")
    poster_key = models.CharField(max_length=500, blank=True)
    renditions = models.JSONField(
        default=dict, blank=True, help_text='e.g. {"1080": "<key>", "720": "<key>"}'
    )
    content_type = models.CharField(max_length=100, blank=True)
    bytes = models.BigIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    blurhash = models.CharField(max_length=64, blank=True, help_text="LQIP placeholder.")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["restaurant_id", "owner_type", "owner_id"]),
            models.Index(fields=["restaurant_id", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.kind}:{self.key}"


class AssetRendition(models.Model):
    """A responsive/transcoded variant of an asset (thumb/card/hero/mp4-720…)."""

    id = models.BigAutoField(primary_key=True)
    restaurant_id = models.UUIDField(db_index=True)
    asset = models.ForeignKey(
        MediaAsset, on_delete=models.CASCADE, related_name="variants"
    )
    variant = models.CharField(max_length=20)
    key = models.CharField(max_length=500)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    bytes = models.BigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["asset", "variant"], name="uniq_asset_variant"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.asset_id}:{self.variant}"
