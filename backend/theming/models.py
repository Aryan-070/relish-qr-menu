"""Per-restaurant theme configuration (1:1 with an outlet).

Stores the *selection* (ui_theme / component_style / media_mode) plus a partial
``token_overrides`` patch. The base token presets live in the frontend
(``src/theme/themes.ts``); the client applies ``THEMES[ui_theme]`` and layers the
overrides on top — so the backend never needs to port the full token tables.

A two-state draft→publish workflow: edits land in ``draft`` (a partial config),
``published`` gates the public read path together with subscription status.
``logo_url``/``cover_url`` are interim (Phase 4 swaps them for media asset FKs).
"""
from django.db import models

from accounts.models import Restaurant
from common.models import TimeStampedModel

UI_THEME_CHOICES = (
    ("warm", "Warm"),
    ("hybrid", "Hybrid"),
    ("brutalist", "Brutalist"),
    ("editorial", "Editorial"),
    ("table-theory", "Table Theory"),
)
# The 7 consumer landing/cover designs (src/screens/Landing*.tsx). Selected per
# restaurant and surfaced to the guest app via public_theme_config.
LANDING_VARIANT_CHOICES = (
    ("signature", "Signature"),
    ("classic", "Classic"),
    ("gastronomique", "Deco"),
    ("editorial", "Editorial"),
    ("botanica", "Botanica"),
    ("cinematic", "Cinema"),
    ("reel", "Reel"),
)
COMPONENT_STYLE_CHOICES = (
    ("classic", "Classic"),
    ("motion", "Motion"),
    ("spectacle", "Spectacle"),
)
MEDIA_MODE_CHOICES = (
    ("video", "Video"),
    ("image", "Image"),
)


class RestaurantTheme(TimeStampedModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="theme",
    )
    ui_theme = models.CharField(max_length=20, choices=UI_THEME_CHOICES, default="warm")
    landing_variant = models.CharField(
        max_length=20, choices=LANDING_VARIANT_CHOICES, default="signature"
    )
    component_style = models.CharField(
        max_length=20, choices=COMPONENT_STYLE_CHOICES, default="classic"
    )
    media_mode = models.CharField(
        max_length=20, choices=MEDIA_MODE_CHOICES, default="image"
    )
    token_overrides = models.JSONField(
        default=dict, blank=True, help_text="Partial ThemeTokens patch (colors/fonts)."
    )
    brand_colors = models.JSONField(
        default=dict,
        blank=True,
        help_text="Brand color overrides: {primary, secondary, accent} as hex.",
    )
    font_choices = models.JSONField(
        default=dict,
        blank=True,
        help_text="Selected font families: {heading, body}.",
    )
    custom_font = models.JSONField(
        default=dict,
        blank=True,
        help_text="An imported font: {name, url} (woff2/woff).",
    )
    allow_customer_choice = models.BooleanField(default=False)
    customer_choices = models.JSONField(
        default=list, blank=True, help_text="Subset of ui_themes a guest may pick."
    )
    draft = models.JSONField(
        default=dict, blank=True, help_text="Unpublished working copy of the config."
    )
    published = models.BooleanField(default=False)
    logo_url = models.CharField(max_length=500, blank=True)
    cover_url = models.CharField(max_length=500, blank=True)

    def __str__(self) -> str:
        return f"theme<{self.restaurant_id}:{self.ui_theme}>"
