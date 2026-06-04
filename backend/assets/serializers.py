"""Serializers for the media-asset API.

``MediaAssetSerializer`` is read-only output (the row is never client-mutable;
it is created by the presign service and advanced by the complete-upload
endpoint). ``PresignRequestSerializer`` validates the *request* for a presigned
upload URL — the only client-supplied payload in this slice.
"""
from __future__ import annotations

from rest_framework import serializers

from assets.models import KIND_CHOICES, OWNER_TYPE_CHOICES, MediaAsset
from assets.services import asset_public_url


class MediaAssetSerializer(serializers.ModelSerializer):
    """Read-only representation of a stored media asset."""

    public_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = (
            "id",
            "kind",
            "status",
            "owner_type",
            "owner_id",
            "key",
            "public_url",
            "renditions",
            "poster_key",
            "bytes",
            "width",
            "height",
            "blurhash",
            "created_at",
        )
        read_only_fields = fields

    def get_public_url(self, obj: MediaAsset) -> str:
        return asset_public_url(obj)


class PresignRequestSerializer(serializers.Serializer):
    """Validate a request for a presigned upload URL.

    Policy (content-type / size / quota) is enforced in the service layer; this
    serializer only guarantees the shape: a known ``kind``, a non-empty
    ``content_type``, a strictly positive ``size_bytes``, and optional owner
    linkage.
    """

    kind = serializers.ChoiceField(choices=[choice[0] for choice in KIND_CHOICES])
    content_type = serializers.CharField(max_length=100)
    size_bytes = serializers.IntegerField(min_value=1)
    owner_type = serializers.ChoiceField(
        choices=[choice[0] for choice in OWNER_TYPE_CHOICES],
        required=False,
        allow_blank=True,
        default="",
    )
    owner_id = serializers.UUIDField(required=False, allow_null=True, default=None)
