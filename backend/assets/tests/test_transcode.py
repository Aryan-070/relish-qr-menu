"""Tests for the video transcode pipeline (``assets.transcode`` + the
``transcode_asset`` Celery task).

boto3 and ffmpeg are isolated behind ``_s3_client``, ``_run_ffmpeg`` and
``_extract_poster``; every test patches those so nothing touches real S3 or
spawns ffmpeg. With ``CELERY_TASK_ALWAYS_EAGER`` the task runs synchronously,
so calling it drives the whole orchestrator inline.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from unittest import mock

import pytest
from django.test import override_settings

from assets.models import AssetRendition, MediaAsset
from assets.tasks import transcode_asset
from assets.transcode import TranscodeError

pytestmark = pytest.mark.django_db

SETTINGS = {
    "ASSET_BUCKET": "relish-media",
    "ASSET_VIDEO_RENDITION_HEIGHTS": [720, 360],
}


def _make_video_asset(status: str = "processing") -> MediaAsset:
    """Create a processing video ``MediaAsset`` directly via the ORM."""
    return MediaAsset.all_objects.create(
        restaurant_id=uuid.uuid4(),
        kind="video",
        bucket="relish-media",
        key="tenant/source/clip.mov",
        status=status,
    )


def _touch_output(*args, **kwargs) -> None:
    """ffmpeg stand-in: 'produce' the output file the orchestrator expects.

    Both ``_run_ffmpeg(input, output, height)`` and
    ``_extract_poster(input, output)`` take the output path as the 2nd arg.
    """
    output_path = args[1]
    Path(output_path).write_bytes(b"x" * 16)


def _fake_s3() -> mock.Mock:
    """A boto3-style client whose download/upload are no-ops."""
    client = mock.Mock()
    client.download_file.return_value = None
    client.upload_file.return_value = None
    return client


@override_settings(**SETTINGS)
def test_happy_path_marks_ready_with_renditions_and_poster() -> None:
    asset = _make_video_asset()
    fake_client = _fake_s3()

    with (
        mock.patch("assets.transcode._s3_client", return_value=fake_client),
        mock.patch("assets.transcode._run_ffmpeg", side_effect=_touch_output),
        mock.patch("assets.transcode._extract_poster", side_effect=_touch_output),
    ):
        transcode_asset(str(asset.id))

    asset.refresh_from_db()
    assert asset.status == "ready"

    # renditions dict keyed by each configured height
    assert set(asset.renditions.keys()) == {"720", "360"}
    assert asset.renditions["720"] == f"{asset.restaurant_id}/video/{asset.id}/720.mp4"
    assert asset.renditions["360"] == f"{asset.restaurant_id}/video/{asset.id}/360.mp4"

    # poster set
    assert asset.poster_key == f"{asset.restaurant_id}/video/{asset.id}/poster.jpg"

    # one AssetRendition row per height, all stamped with the asset's tenant
    rows = AssetRendition.objects.filter(asset=asset).order_by("variant")
    assert [r.variant for r in rows] == ["mp4-360", "mp4-720"]
    assert all(r.restaurant_id == asset.restaurant_id for r in rows)
    assert {r.height for r in rows} == {360, 720}


@override_settings(**SETTINGS)
def test_three_heights_default_config() -> None:
    """With the production 3-height config we get mp4-1080/720/360."""
    asset = _make_video_asset()
    fake_client = _fake_s3()

    with (
        override_settings(ASSET_VIDEO_RENDITION_HEIGHTS=[1080, 720, 360]),
        mock.patch("assets.transcode._s3_client", return_value=fake_client),
        mock.patch("assets.transcode._run_ffmpeg", side_effect=_touch_output),
        mock.patch("assets.transcode._extract_poster", side_effect=_touch_output),
    ):
        transcode_asset(str(asset.id))

    asset.refresh_from_db()
    assert asset.status == "ready"
    variants = set(
        AssetRendition.objects.filter(asset=asset).values_list("variant", flat=True)
    )
    assert variants == {"mp4-1080", "mp4-720", "mp4-360"}


@override_settings(**SETTINGS)
def test_failure_path_marks_failed_no_partial_ready() -> None:
    asset = _make_video_asset()
    fake_client = _fake_s3()

    with (
        mock.patch("assets.transcode._s3_client", return_value=fake_client),
        mock.patch(
            "assets.transcode._run_ffmpeg",
            side_effect=TranscodeError("boom"),
        ),
        mock.patch("assets.transcode._extract_poster", side_effect=_touch_output),
        pytest.raises(TranscodeError),
    ):
        transcode_asset(str(asset.id))

    asset.refresh_from_db()
    assert asset.status == "failed"
    assert asset.renditions == {}
    assert asset.poster_key == ""


@override_settings(**SETTINGS)
def test_idempotent_no_duplicate_renditions() -> None:
    asset = _make_video_asset()
    fake_client = _fake_s3()

    patches = (
        mock.patch("assets.transcode._s3_client", return_value=fake_client),
        mock.patch("assets.transcode._run_ffmpeg", side_effect=_touch_output),
        mock.patch("assets.transcode._extract_poster", side_effect=_touch_output),
    )
    with patches[0], patches[1], patches[2]:
        transcode_asset(str(asset.id))
        # re-run: asset is now 'ready', which is NOT runnable -> task no-ops.
        # Flip back to a runnable status to force a real second pass.
        asset.refresh_from_db()
        asset.status = "processing"
        asset.save(update_fields=["status"])
        transcode_asset(str(asset.id))

    # update_or_create on (asset, variant) keeps exactly one row per height
    assert AssetRendition.objects.filter(asset=asset).count() == 2


@override_settings(**SETTINGS)
def test_missing_asset_is_noop() -> None:
    # No asset created; a random id must not raise.
    assert transcode_asset(str(uuid.uuid4())) is None


@override_settings(**SETTINGS)
def test_ready_asset_is_skipped() -> None:
    asset = _make_video_asset(status="ready")
    with mock.patch("assets.transcode._run_ffmpeg") as run:
        result = transcode_asset(str(asset.id))
    assert result is None
    run.assert_not_called()
