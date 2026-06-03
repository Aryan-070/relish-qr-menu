"""Menu domain: categories, items, and shared modifier groups.

All models are tenant-scoped (``common.models.TenantScopedModel`` gives them a
UUID pk, an indexed ``restaurant_id``, ``created_at``/``updated_at``, a
``deleted_at`` soft-delete, the tenant-filtering ``objects`` manager and the
unscoped ``all_objects`` manager).

Money is stored in integer minor units (paise). ``image_url``/``video_url`` are
interim CharFields (they accept /assets paths, external URLs, or — pre-Phase 4 —
nothing); Phase 4 replaces them with ``media.MediaAsset`` foreign keys.
"""
from django.db import models

from common.models import TenantScopedModel

UI_SPICE_CHOICES = ((0, "None"), (1, "Mild"), (2, "Medium"), (3, "Hot"))


class MenuCategory(TenantScopedModel):
    code = models.CharField(max_length=60)
    name = models.CharField(max_length=120)
    sort_order = models.IntegerField(default=0)
    banner_url = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "menu categories"
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant_id", "code"], name="uniq_category_restaurant_code"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class MenuItem(TenantScopedModel):
    category = models.ForeignKey(
        MenuCategory, on_delete=models.PROTECT, related_name="items"
    )
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=160)
    price_minor = models.IntegerField(default=0, help_text="Price in paise.")
    description = models.TextField(blank=True)
    tax_rate_pct = models.PositiveSmallIntegerField(default=5)
    tags = models.JSONField(default=list, blank=True)
    badges = models.JSONField(default=list, blank=True)
    is_jain = models.BooleanField(default=False)
    can_be_jain = models.BooleanField(default=False)
    chefs_special = models.BooleanField(default=False)
    spice_level = models.PositiveSmallIntegerField(default=0, choices=UI_SPICE_CHOICES)
    available = models.BooleanField(default=True)
    sold_out = models.BooleanField(default=False)
    image_url = models.CharField(max_length=500, blank=True)
    video_url = models.CharField(max_length=500, blank=True)
    nutrition = models.JSONField(default=dict, blank=True)
    # Optimistic-concurrency token: bumped on each save by the console layer.
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["category__sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant_id", "code"], name="uniq_item_restaurant_code"
            ),
        ]
        indexes = [
            models.Index(fields=["restaurant_id", "category"]),
            models.Index(fields=["restaurant_id", "available"]),
        ]

    def __str__(self) -> str:
        return self.name


class ModifierGroup(TenantScopedModel):
    name = models.CharField(max_length=120)
    min_select = models.PositiveSmallIntegerField(default=0)
    max_select = models.PositiveSmallIntegerField(default=1)
    items = models.ManyToManyField(
        MenuItem, through="MenuItemModifierGroup", related_name="modifier_groups"
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Modifier(TenantScopedModel):
    group = models.ForeignKey(
        ModifierGroup, on_delete=models.CASCADE, related_name="modifiers"
    )
    label = models.CharField(max_length=120)
    price_delta_minor = models.IntegerField(default=0, help_text="Delta in paise.")

    class Meta:
        ordering = ["label"]

    def __str__(self) -> str:
        return self.label


class MenuItemModifierGroup(models.Model):
    """Join row letting a modifier group be shared across many items."""

    menu_item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE, related_name="modifier_links"
    )
    group = models.ForeignKey(
        ModifierGroup, on_delete=models.CASCADE, related_name="item_links"
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]
        constraints = [
            models.UniqueConstraint(
                fields=["menu_item", "group"], name="uniq_item_modifier_group"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.menu_item_id}+{self.group_id}"
