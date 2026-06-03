"""API views for the theming slice (mounted under ``/api/theme/``).

Three endpoints, all tenant-scoped:

* :class:`ThemeView` — read / update the live theme config.
* :class:`ThemeDraftView` — read / save the unpublished ``draft`` patch.
* :class:`ThemePublishView` — promote the draft and publish.

Reads require an authenticated tenant member; writes additionally require the
``manage-theme`` permission.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from common.context import get_current_restaurant_id
from common.permissions import HasPermission, IsTenantMember
from theming.serializers import RestaurantThemeSerializer, ThemeDraftSerializer
from theming.services import get_or_create_theme, public_theme_config, publish_theme

_MANAGE_THEME = HasPermission("manage-theme")


def _no_tenant_response() -> Response:
    return Response(
        {
            "success": False,
            "error": "no_active_restaurant",
            "detail": "No active restaurant bound.",
        },
        status=status.HTTP_404_NOT_FOUND,
    )


class ThemeView(APIView):
    """Read (GET) or update (PUT) the live theme config for the caller's outlet."""

    def get_permissions(self):
        base = [IsAuthenticated(), IsTenantMember()]
        if self.request.method == "PUT":
            base.append(_MANAGE_THEME())
        return base

    def get(self, request: Request) -> Response:
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return _no_tenant_response()
        theme = get_or_create_theme(restaurant_id)
        return Response(RestaurantThemeSerializer(theme).data)

    def put(self, request: Request) -> Response:
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return _no_tenant_response()
        theme = get_or_create_theme(restaurant_id)
        serializer = RestaurantThemeSerializer(theme, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ThemeDraftView(APIView):
    """Read (GET) or save (PUT) the unpublished ``draft`` config patch."""

    def get_permissions(self):
        base = [IsAuthenticated(), IsTenantMember()]
        if self.request.method == "PUT":
            base.append(_MANAGE_THEME())
        return base

    def get(self, request: Request) -> Response:
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return _no_tenant_response()
        theme = get_or_create_theme(restaurant_id)
        return Response({"draft": theme.draft})

    def put(self, request: Request) -> Response:
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return _no_tenant_response()
        serializer = ThemeDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        theme = get_or_create_theme(restaurant_id)
        theme.draft = serializer.validated_data["draft"]
        theme.save(update_fields=["draft", "updated_at"])
        return Response({"draft": theme.draft})


class ThemePublishView(APIView):
    """Promote the draft onto the live config and publish (POST)."""

    def get_permissions(self):
        return [IsAuthenticated(), IsTenantMember(), _MANAGE_THEME()]

    def post(self, request: Request) -> Response:
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return _no_tenant_response()
        theme = get_or_create_theme(restaurant_id)
        publish_theme(theme)
        return Response(public_theme_config(restaurant_id))
