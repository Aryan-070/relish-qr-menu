"""Service layer for the per-restaurant theming slice.

This module owns the *business* operations for restaurant themes so the views
stay thin. The canonical public resolver :func:`public_theme_config` lives here
because the public consumer app imports it directly — it must only ever return
safe display fields and never leak draft/internal state.
"""
from __future__ import annotations

from typing import Any

from theming.models import (
    COMPONENT_STYLE_CHOICES,
    MEDIA_MODE_CHOICES,
    UI_THEME_CHOICES,
    RestaurantTheme,
)

# The subset of fields that make up a published/public theme selection. These
# are the only keys ``publish_theme`` will copy out of ``draft`` and the only
# keys ``public_theme_config`` will ever expose.
_PUBLIC_FIELDS: tuple[str, ...] = (
    "ui_theme",
    "component_style",
    "media_mode",
    "token_overrides",
    "allow_customer_choice",
    "customer_choices",
    "logo_url",
    "cover_url",
)

_UI_THEME_VALUES = frozenset(value for value, _ in UI_THEME_CHOICES)
_COMPONENT_STYLE_VALUES = frozenset(value for value, _ in COMPONENT_STYLE_CHOICES)
_MEDIA_MODE_VALUES = frozenset(value for value, _ in MEDIA_MODE_CHOICES)

# Enum-constrained fields mapped to their set of allowed values. A draft value
# that is not a member of the matching set is ignored during publish.
_ENUM_FIELDS: dict[str, frozenset[str]] = {
    "ui_theme": _UI_THEME_VALUES,
    "component_style": _COMPONENT_STYLE_VALUES,
    "media_mode": _MEDIA_MODE_VALUES,
}

# A sensible default returned by ``public_theme_config`` when no row exists.
_DEFAULT_PUBLIC_CONFIG: dict[str, Any] = {
    "ui_theme": "warm",
    "component_style": "classic",
    "media_mode": "image",
    "token_overrides": {},
    "allow_customer_choice": False,
    "customer_choices": [],
    "logo_url": "",
    "cover_url": "",
}


def get_or_create_theme(restaurant_id: Any) -> RestaurantTheme:
    """Return the theme for ``restaurant_id``, creating a default row if absent.

    ``restaurant_id`` is the ``Restaurant`` primary key (a UUID). The created
    row uses model defaults (warm / classic / image, empty overrides).
    """
    theme, _ = RestaurantTheme.objects.get_or_create(restaurant_id=restaurant_id)
    return theme


def publish_theme(theme: RestaurantTheme) -> RestaurantTheme:
    """Promote ``theme.draft`` onto the live selection fields and publish it.

    Recognised keys from ``draft`` are merged onto the live config. Enum fields
    are validated against their allowed value sets; invalid or unknown keys are
    ignored. ``published`` is set ``True`` and ``draft`` is cleared to ``{}``.
    """
    draft = theme.draft if isinstance(theme.draft, dict) else {}

    for field in _PUBLIC_FIELDS:
        if field not in draft:
            continue
        value = draft[field]
        allowed = _ENUM_FIELDS.get(field)
        if allowed is not None and value not in allowed:
            continue
        setattr(theme, field, value)

    theme.published = True
    theme.draft = {}
    theme.save()
    return theme


def public_theme_config(restaurant_id: Any) -> dict[str, Any]:
    """Return the safe, public-facing theme config for ``restaurant_id``.

    This is the canonical resolver imported by the public consumer app. It
    returns ONLY display fields (see :data:`_PUBLIC_FIELDS`) — never ``draft``,
    ``published`` or any other internal field. When no theme row exists it
    returns a sensible default config. The public app gates on publish state
    separately, so this resolver does not consider ``published``.
    """
    theme = (
        RestaurantTheme.objects.filter(restaurant_id=restaurant_id)
        .only(*_PUBLIC_FIELDS)
        .first()
    )
    if theme is None:
        return dict(_DEFAULT_PUBLIC_CONFIG)
    return {field: getattr(theme, field) for field in _PUBLIC_FIELDS}
