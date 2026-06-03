"""MEDIA_TRANSCODE_ENABLED gate: without a worker, videos serve the original."""
import uuid
from unittest.mock import patch

import pytest
from django.test import override_settings

from assets.models import MediaAsset
from assets.services import complete_upload

pytestmark = pytest.mark.django_db


def _video_asset() -> MediaAsset:
    return MediaAsset.all_objects.create(
        restaurant_id=uuid.uuid4(),
        kind="video",
        bucket="relish-media",
        key=f"{uuid.uuid4().hex}.mp4",
        content_type="video/mp4",
        bytes=1234,
        status="pending",
    )


@override_settings(MEDIA_TRANSCODE_ENABLED=False)
def test_video_complete_without_worker_marks_ready():
    asset = _video_asset()
    with patch("assets.tasks.transcode_asset") as task:
        complete_upload(asset)
        task.delay.assert_not_called()
    asset.refresh_from_db()
    assert asset.status == "ready"


@override_settings(MEDIA_TRANSCODE_ENABLED=True)
def test_video_complete_with_worker_enqueues_transcode():
    asset = _video_asset()
    with patch("assets.tasks.transcode_asset") as task:
        complete_upload(asset)
        task.delay.assert_called_once_with(str(asset.id))
    asset.refresh_from_db()
    assert asset.status == "processing"
