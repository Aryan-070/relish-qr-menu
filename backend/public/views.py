"""Public, unauthenticated guest-menu view.

This is the endpoint a diner hits after scanning a table QR code. It is open to
the world (``AllowAny``, no authentication), rate-limited via the shared
``public_menu`` throttle scope, and serves a cached, safe-fields-only payload.
When a restaurant is not publicly servable, it returns a branded
``{"available": false}`` without leaking *why*.
"""
from __future__ import annotations

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import Restaurant

from .services import (
    build_public_menu,
    is_restaurant_public,
    public_menu_cache_key,
)

# How long an assembled menu payload stays warm in the cache (seconds).
_MENU_CACHE_TTL = 60


class PublicMenuView(APIView):
    """GET the public menu for a restaurant by id."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_menu"

    def get(self, request, restaurant_id, *args, **kwargs):
        restaurant = Restaurant.objects.filter(pk=restaurant_id).first()
        if restaurant is None:
            return Response({"detail": "Not found."}, status=404)

        if not is_restaurant_public(restaurant):
            # Branded "temporarily unavailable" — never disclose the reason.
            return Response({"available": False})

        cache_key = public_menu_cache_key(restaurant.id)
        payload = cache.get(cache_key)
        if payload is None:
            payload = build_public_menu(restaurant)
            cache.set(cache_key, payload, _MENU_CACHE_TTL)

        return Response({"available": True, **payload})
