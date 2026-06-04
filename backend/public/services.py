"""Service layer for the public guest menu.

Holds the publish/paid gate and the menu-assembly logic. Because the diner is
anonymous, there is no bound tenant context, so every menu query filters
``restaurant_id`` and ``deleted_at`` *explicitly* via ``all_objects``. The
assembled payload is built through the safe-field serializers in
:mod:`public.serializers`, so only allowlisted fields ever reach the wire.
"""
from __future__ import annotations

from typing import Any

from billing.models import Subscription
from menu.models import MenuCategory, MenuItem
from theming.services import public_theme_config

from .serializers import (
    PublicCategorySerializer,
    PublicMenuItemSerializer,
)

# Allowlisted item fields copied straight off the model. The serializer is the
# enforcing layer; this list mirrors it so assembly never reaches for an
# unlisted (internal) attribute.
_SAFE_ITEM_FIELDS: tuple[str, ...] = (
    "id",
    "code",
    "name",
    "price_minor",
    "description",
    "tags",
    "badges",
    "is_jain",
    "can_be_jain",
    "chefs_special",
    "spice_level",
    "available",
    "sold_out",
    "image_url",
    "video_url",
    "nutrition",
)

# Cache namespace + version. Bump ``_CACHE_VERSION`` to invalidate every cached
# menu at once (e.g. after a payload-shape change).
_CACHE_VERSION = "v2"


def public_menu_cache_key(restaurant_id: Any) -> str:
    """Return the Django cache key for a restaurant's public menu payload."""
    return f"public_menu:{_CACHE_VERSION}:{restaurant_id}"


def bust_public_menu_cache(restaurant_id: Any) -> None:
    """Evict a restaurant's cached public menu.

    Call this on publish/unpublish and on any menu edit so the next guest
    request rebuilds from the database.
    """
    from django.core.cache import cache

    cache.delete(public_menu_cache_key(restaurant_id))


def is_restaurant_public(restaurant: Any) -> bool:
    """True iff this restaurant's menu may be served to anonymous diners.

    The gate is: published AND active AND not soft-deleted AND the owning org
    has an ``active`` subscription. Any failure means we serve a branded
    "temporarily unavailable" instead — never the reason why.
    """
    if not (restaurant.published and restaurant.active and restaurant.deleted_at is None):
        return False
    return Subscription.objects.filter(
        org_id=restaurant.org_id, status=Subscription.Status.ACTIVE
    ).exists()


def _item_to_safe_dict(item: MenuItem) -> dict[str, Any]:
    """Project a ``MenuItem`` (with prefetched modifiers) onto the safe fields."""
    data: dict[str, Any] = {field: getattr(item, field) for field in _SAFE_ITEM_FIELDS}
    data["modifier_groups"] = [
        {
            "id": group.id,
            "name": group.name,
            "min_select": group.min_select,
            "max_select": group.max_select,
            "modifiers": [
                {
                    "id": modifier.id,
                    "label": modifier.label,
                    "price_delta_minor": modifier.price_delta_minor,
                }
                for modifier in group.modifiers.all()
            ],
        }
        for group in item.modifier_groups.all()
    ]
    # Round-trip through the serializer so the allowlist is enforced (any stray
    # key in ``data`` is dropped by the declared fields).
    return dict(PublicMenuItemSerializer(data).data)


def _serialize_category(category: MenuCategory, items: list[MenuItem]) -> dict[str, Any]:
    """Serialize one category + its already-filtered, ordered items."""
    payload = PublicCategorySerializer(
        {
            "id": category.id,
            "code": category.code,
            "name": category.name,
            "sort_order": category.sort_order,
            "items": [_item_to_safe_dict(item) for item in items],
        }
    ).data
    return dict(payload)


def build_public_menu(restaurant: Any) -> dict[str, Any]:
    """Assemble the full guest payload for a public restaurant.

    Returns ``{restaurant, theme, categories}`` where categories contain only
    those with at least one ``available`` item, items are ``available`` only,
    and ordering is ``category.sort_order`` then ``item.name``. All queries are
    explicitly tenant-scoped via ``all_objects`` and prefetch modifier data to
    avoid N+1.
    """
    rid = restaurant.id

    items = list(
        MenuItem.all_objects.filter(
            restaurant_id=rid, deleted_at__isnull=True, available=True
        )
        .select_related("category")
        .prefetch_related("modifier_groups__modifiers")
        .order_by("category__sort_order", "name")
    )

    # Group available items by their category, preserving the queryset order
    # (sort_order, then name). Only categories with >= 1 item survive.
    categories_payload: list[dict[str, Any]] = []
    seen_category_ids: set[Any] = set()
    items_by_category: dict[Any, list[MenuItem]] = {}
    category_order: list[MenuCategory] = []

    for item in items:
        category = item.category
        if category is None or category.deleted_at is not None:
            continue
        if category.id not in seen_category_ids:
            seen_category_ids.add(category.id)
            category_order.append(category)
            items_by_category[category.id] = []
        items_by_category[category.id].append(item)

    for category in category_order:
        categories_payload.append(
            _serialize_category(category, items_by_category[category.id])
        )

    return {
        "restaurant": {"id": str(restaurant.id), "name": restaurant.name},
        "theme": public_theme_config(rid),
        "categories": categories_payload,
    }
