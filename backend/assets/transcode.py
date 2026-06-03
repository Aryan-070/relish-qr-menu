"""Video transcode pipeline: ffmpeg renditions + poster, recorded as
:class:`~assets.models.AssetRendition` rows.

The orchestrator :func:`transcode_video` downloads a source video from object
storage into a temp dir, produces an h264/aac mp4 for each height in
``settings.ASSET_VIDEO_RENDITION_HEIGHTS`` (scaled keeping aspect ratio),
extracts a poster frame, uploads everything back to the bucket, and stamps the
:class:`~assets.models.MediaAsset` with ``renditions``/``poster_key``/``status``.

boto3 and ffmpeg are isolated behind :func:`_s3_client` and :func:`_run_ffmpeg`
(plus :func:`_extract_poster`) so tests can patch them without real S3/ffmpeg.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import boto3
from django.conf import settings

from .models import AssetRendition, MediaAsset


class TranscodeError(Exception):
    """Raised when ffmpeg (or the surrounding transcode step) fails."""


def _s3_client():
    """Build a boto3 S3 client from Django settings (endpoint/region)."""
    return boto3.client(
        "s3",
        endpoint_url=settings.ASSET_S3_ENDPOINT_URL,
        region_name=settings.ASSET_S3_REGION,
    )


def _download_source(asset: MediaAsset, dest_path: str) -> None:
    """Download the asset's source object to ``dest_path``."""
    _s3_client().download_file(asset.bucket, asset.key, dest_path)


def _upload_rendition(
    asset: MediaAsset, src_path: str, key: str, content_type: str
) -> None:
    """Upload a local rendition file to the asset's bucket under ``key``."""
    _s3_client().upload_file(
        src_path,
        asset.bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def _run_ffmpeg(input_path: str, output_path: str, height: int) -> None:
    """Transcode ``input_path`` to an h264/aac mp4 scaled to ``height`` px.

    The width is computed to preserve aspect ratio and forced even (``-2``),
    which h264 requires. Raises :class:`TranscodeError` on a non-zero exit.
    """
    args = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-vf",
        f"scale=-2:{height}",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        output_path,
    ]
    try:
        subprocess.run(args, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode("utf-8", "replace") if exc.stderr else ""
        raise TranscodeError(
            f"ffmpeg failed for height={height} (exit {exc.returncode}): {stderr}"
        ) from exc


def _extract_poster(input_path: str, output_path: str) -> None:
    """Grab a single poster frame (at ~1s) from the source video."""
    args = [
        "ffmpeg",
        "-y",
        "-ss",
        "1",
        "-i",
        input_path,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        output_path,
    ]
    try:
        subprocess.run(args, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode("utf-8", "replace") if exc.stderr else ""
        raise TranscodeError(
            f"ffmpeg poster extraction failed (exit {exc.returncode}): {stderr}"
        ) from exc


def _file_size(path: str) -> int:
    """Best-effort byte size for an output file (0 if absent)."""
    try:
        return Path(path).stat().st_size
    except OSError:
        return 0


def transcode_video(asset: MediaAsset) -> MediaAsset:
    """Produce renditions + poster for ``asset`` and mark it ready.

    On any failure the asset is flipped to ``status='failed'`` (no partial
    ``ready``) and the original exception is re-raised.
    """
    heights = list(settings.ASSET_VIDEO_RENDITION_HEIGHTS)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source_path = str(tmp_path / "source")
            _download_source(asset, source_path)

            renditions: dict[str, str] = {}
            for height in heights:
                out_path = str(tmp_path / f"{height}.mp4")
                key = f"{asset.restaurant_id}/video/{asset.id}/{height}.mp4"
                _run_ffmpeg(source_path, out_path, height)
                _upload_rendition(asset, out_path, key, "video/mp4")
                AssetRendition.objects.update_or_create(
                    asset=asset,
                    variant=f"mp4-{height}",
                    defaults={
                        "restaurant_id": asset.restaurant_id,
                        "key": key,
                        "height": height,
                        "bytes": _file_size(out_path),
                    },
                )
                renditions[str(height)] = key

            poster_path = str(tmp_path / "poster.jpg")
            poster_key = f"{asset.restaurant_id}/video/{asset.id}/poster.jpg"
            _extract_poster(source_path, poster_path)
            _upload_rendition(asset, poster_path, poster_key, "image/jpeg")

            asset.renditions = renditions
            asset.poster_key = poster_key
            asset.status = "ready"
            asset.save(update_fields=["renditions", "poster_key", "status"])
    except Exception:
        asset.status = "failed"
        asset.save(update_fields=["status"])
        raise

    return asset
