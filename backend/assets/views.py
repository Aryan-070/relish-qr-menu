"""DRF views for the media-asset slice.

Three surfaces, all tenant-scoped end to end:

* :class:`PresignView` — POST a declared upload, get back a presigned PUT URL
  and a freshly created ``pending`` asset (bytes go client -> storage directly).
* :class:`CompleteUploadView` — POST after the storage PUT to advance the asset
  (``ready`` for images, ``processing`` + transcode enqueue for video).
* :class:`MediaAssetViewSet` — list / retrieve / soft-delete the tenant's assets.

Reads require an authenticated tenant member; every mutation (presign, complete,
destroy) additionally requires the ``edit-menu`` permission.
"""
from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assets.models import MediaAsset
from assets.serializers import MediaAssetSerializer, PresignRequestSerializer
from assets.services import (
    MediaConfigError,
    MediaValidationError,
    QuotaExceeded,
    asset_public_url,
    complete_upload,
    presign_upload,
)
from common.context import get_current_restaurant_id
from common.permissions import HasPermission, IsTenantMember

#: Permission key gating every media mutation.
EDIT_MENU_PERMISSION = "edit-menu"


def _write_permissions() -> list[Any]:
    """Authenticated tenant member who additionally holds ``edit-menu``."""
    return [IsAuthenticated(), IsTenantMember(), HasPermission(EDIT_MENU_PERMISSION)()]


class PresignView(APIView):
    """Mint a presigned PUT URL for a direct-to-storage upload."""

    def get_permissions(self) -> list[Any]:
        return _write_permissions()

    @extend_schema(
        request=PresignRequestSerializer,
        responses={
            200: inline_serializer(
                "PresignResult",
                {
                    "asset_id": serializers.CharField(),
                    "upload_url": serializers.URLField(),
                    "key": serializers.CharField(),
                    "public_url": serializers.URLField(),
                },
            )
        },
        tags=["media"],
    )
    def post(self, request: Any) -> Response:
        serializer = PresignRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            asset, upload_url = presign_upload(
                restaurant_id=get_current_restaurant_id(),
                kind=data["kind"],
                content_type=data["content_type"],
                size_bytes=data["size_bytes"],
                owner_type=data.get("owner_type") or "",
                owner_id=data.get("owner_id"),
            )
        except (MediaValidationError, QuotaExceeded) as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        except MediaConfigError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        return Response(
            {
                "asset_id": str(asset.id),
                "upload_url": upload_url,
                "key": asset.key,
                "public_url": asset_public_url(asset),
            },
            status=status.HTTP_201_CREATED,
        )


class CompleteUploadView(APIView):
    """Confirm a finished upload and advance the asset's lifecycle status."""

    def get_permissions(self) -> list[Any]:
        return _write_permissions()

    @extend_schema(
        request=None,
        responses={200: MediaAssetSerializer},
        tags=["media"],
    )
    def post(self, request: Any, pk: Any) -> Response:
        asset = MediaAsset.objects.filter(
            restaurant_id=get_current_restaurant_id(), pk=pk
        ).first()
        if asset is None:
            return Response(
                {"detail": "Asset not found."}, status=status.HTTP_404_NOT_FOUND
            )

        asset = complete_upload(asset)
        return Response(MediaAssetSerializer(asset).data, status=status.HTTP_200_OK)


class MediaAssetViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """List / retrieve / soft-delete the active tenant's media assets.

    Supports ``?owner_type=&owner_id=`` filtering for fetching the assets bound
    to a particular menu item / category / restaurant.
    """

    serializer_class = MediaAssetSerializer

    def get_permissions(self) -> list[Any]:
        if self.action == "destroy":
            return _write_permissions()
        return [IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        """Active-tenant rows only, with optional owner filtering."""
        queryset = MediaAsset.objects.filter(
            restaurant_id=get_current_restaurant_id()
        )
        owner_type = self.request.query_params.get("owner_type")
        owner_id = self.request.query_params.get("owner_id")
        if owner_type:
            queryset = queryset.filter(owner_type=owner_type)
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)
        return queryset

    def perform_destroy(self, instance: MediaAsset) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()
