"""Media-asset service layer: presigned uploads, quota / MIME / size policy.

The bytes never transit this server. The client asks for a presigned PUT URL
(:func:`presign_upload`), uploads the object **directly** to S3 / Cloudflare R2,
then calls back to confirm (:func:`complete_upload`). We only ever record *where*
the bytes live (bucket + key) and how big the client *declared* them to be — the
declared size is what we charge against the tenant quota and validate up front.

Policy is enforced server-side here, not in the view:

* :func:`validate_upload` — content-type allow-list + per-kind byte ceiling.
* :func:`presign_upload` — runs ``validate_upload`` *and* the tenant quota check
  before any row is created or any URL is minted.

The boto3 client is built behind :func:`_s3_client` so tests can patch the
single seam ``assets.services._s3_client`` and never touch the network.
"""
from __future__ import annotations

import uuid

from django.conf import settings

from assets.models import MediaAsset

# Presigned PUT URLs are short-lived: 15 minutes is plenty for a browser upload.
PRESIGN_EXPIRES_IN = 900

# The four image-family kinds share the image content-type / size policy.
IMAGE_KINDS = frozenset({"image", "logo", "cover", "banner"})

# Fallback extensions for content-types we cannot mechanically split.
_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
}


class MediaError(Exception):
    """Base class for every media-service error."""


class MediaConfigError(MediaError):
    """Storage is misconfigured (e.g. no bucket) — a 5xx, not the caller's fault."""


class MediaValidationError(MediaError):
    """The declared upload violates the content-type / size policy."""


class QuotaExceeded(MediaError):
    """The declared upload would push the tenant past its storage quota."""


def _s3_client():
    """Build a boto3 S3 client from settings.

    Isolated as the single patch seam for tests
    (``assets.services._s3_client``). Raises :class:`MediaConfigError` when no
    bucket is configured, since a presign without a bucket is meaningless.
    """
    if not getattr(settings, "ASSET_BUCKET", None):
        raise MediaConfigError("ASSET_BUCKET is not configured.")

    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=getattr(settings, "ASSET_S3_ENDPOINT_URL", None),
        region_name=getattr(settings, "ASSET_S3_REGION", None),
        # Supabase Storage's S3-compatible endpoint (and most non-AWS S3s)
        # require path-style addressing + SigV4 presigning.
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _extension_for(content_type: str) -> str:
    """Return a sane file extension for ``content_type``.

    Prefers the explicit lookup table; otherwise derives it from the subtype
    (``image/png`` -> ``png``), stripping any ``+suffix`` and parameters.
    """
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized in _CONTENT_TYPE_EXTENSIONS:
        return _CONTENT_TYPE_EXTENSIONS[normalized]
    subtype = normalized.rpartition("/")[2]
    subtype = subtype.split("+", 1)[0]
    return subtype or "bin"


def tenant_usage_bytes(restaurant_id) -> int:
    """Sum of declared ``bytes`` across the tenant's non-deleted assets.

    Uses ``all_objects`` with an explicit ``restaurant_id`` + ``deleted_at``
    filter so the figure is correct regardless of the ambient tenant context
    (this is also called from quota checks before context-bound work).
    """
    from django.db.models import Sum

    total = (
        MediaAsset.all_objects.filter(
            restaurant_id=restaurant_id, deleted_at__isnull=True
        ).aggregate(total=Sum("bytes"))
    )["total"]
    return int(total or 0)


def validate_upload(*, kind: str, content_type: str, size_bytes: int) -> None:
    """Validate a declared upload against the content-type + size policy.

    Image-family kinds (``image``/``logo``/``cover``/``banner``) must carry an
    allowed image content-type and stay within ``ASSET_IMAGE_MAX_BYTES``; the
    ``video`` kind must carry an allowed video content-type and stay within
    ``ASSET_VIDEO_MAX_BYTES``. Raises :class:`MediaValidationError` otherwise.
    """
    if size_bytes <= 0:
        raise MediaValidationError("size_bytes must be a positive integer.")

    if kind in IMAGE_KINDS:
        allowed = set(getattr(settings, "ASSET_ALLOWED_IMAGE_TYPES", []))
        max_bytes = int(getattr(settings, "ASSET_IMAGE_MAX_BYTES", 0))
        label = "image"
    elif kind == "video":
        allowed = set(getattr(settings, "ASSET_ALLOWED_VIDEO_TYPES", []))
        max_bytes = int(getattr(settings, "ASSET_VIDEO_MAX_BYTES", 0))
        label = "video"
    else:
        raise MediaValidationError(f"Unsupported asset kind: {kind!r}.")

    if content_type not in allowed:
        raise MediaValidationError(
            f"content_type {content_type!r} is not an allowed {label} type."
        )
    if size_bytes > max_bytes:
        raise MediaValidationError(
            f"{label} exceeds the maximum size of {max_bytes} bytes."
        )


def presign_upload(
    *,
    restaurant_id,
    kind: str,
    content_type: str,
    size_bytes: int,
    owner_type: str = "",
    owner_id=None,
) -> tuple[MediaAsset, str]:
    """Validate, enforce quota, create a pending asset, and mint a PUT URL.

    Order matters: policy + quota are checked *before* any DB row or presigned
    URL exists, so a rejected upload leaves no trace. On success a ``pending``
    :class:`MediaAsset` is created (the client will flip it via
    :func:`complete_upload` after the direct-to-storage PUT) and a presigned
    ``put_object`` URL is returned.

    Returns ``(asset, upload_url)``.
    """
    validate_upload(kind=kind, content_type=content_type, size_bytes=size_bytes)

    quota = int(getattr(settings, "ASSET_TENANT_QUOTA_BYTES", 0))
    if tenant_usage_bytes(restaurant_id) + size_bytes > quota:
        raise QuotaExceeded(
            "This upload would exceed the tenant storage quota."
        )

    bucket = settings.ASSET_BUCKET
    ext = _extension_for(content_type)
    key = f"{restaurant_id}/{kind}/{uuid.uuid4().hex}.{ext}"

    asset = MediaAsset.objects.create(
        restaurant_id=restaurant_id,
        kind=kind,
        owner_type=owner_type or "",
        owner_id=owner_id,
        bucket=bucket,
        key=key,
        content_type=content_type,
        bytes=size_bytes,
        status="pending",
    )

    upload_url = _s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=PRESIGN_EXPIRES_IN,
    )
    return asset, upload_url


def complete_upload(asset: MediaAsset) -> MediaAsset:
    """Confirm a finished direct-to-storage upload and advance ``status``.

    Videos move to ``processing`` and a transcode job is enqueued (the import is
    deferred so this module never hard-depends on the Celery task at import
    time). Everything else (images / logos / covers / banners) is immediately
    ``ready`` — CDN transforms handle responsive variants on the fly.

    When ``MEDIA_TRANSCODE_ENABLED`` is False (e.g. no Celery worker running),
    videos are marked ``ready`` immediately and served as the uploaded original
    — renditions can be generated later once the worker is enabled.
    """
    transcode_enabled = getattr(settings, "MEDIA_TRANSCODE_ENABLED", True)
    if asset.kind == "video" and transcode_enabled:
        asset.status = "processing"
        asset.save(update_fields=["status", "updated_at"])
        from assets.tasks import transcode_asset

        transcode_asset.delay(str(asset.id))
    else:
        asset.status = "ready"
        asset.save(update_fields=["status", "updated_at"])
    return asset


def asset_public_url(asset: MediaAsset) -> str:
    """Return the publicly servable URL for ``asset``.

    Prefers the configured CDN base (``ASSET_PUBLIC_BASE_URL``); falls back to a
    plain bucket-style URL keyed off the storage endpoint when no CDN is set.
    """
    base = getattr(settings, "ASSET_PUBLIC_BASE_URL", "") or ""
    if base:
        return base.rstrip("/") + "/" + asset.key

    endpoint = getattr(settings, "ASSET_S3_ENDPOINT_URL", None)
    if endpoint:
        return f"{endpoint.rstrip('/')}/{asset.bucket}/{asset.key}"
    return f"https://{asset.bucket}.s3.amazonaws.com/{asset.key}"
