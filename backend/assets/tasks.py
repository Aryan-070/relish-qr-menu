"""Celery tasks for the assets app.

``transcode_asset`` is enqueued by the upload-completion slice
(``transcode_asset.delay(str(asset.id))``) for videos already in
``status='processing'``. It stays thin: load the asset, guard, and delegate to
:func:`assets.transcode.transcode_video` which owns failure marking.
"""
from __future__ import annotations

import logging

from celery import shared_task

from .models import MediaAsset
from .transcode import TranscodeError, transcode_video

logger = logging.getLogger(__name__)

_RUNNABLE_STATUSES = frozenset({"processing", "failed"})


@shared_task(bind=True, max_retries=2)
def transcode_asset(self, asset_id: str) -> str | None:
    """Transcode the video ``MediaAsset`` identified by ``asset_id``.

    Returns the asset id on success. Returns ``None`` (no-op) when the asset is
    missing or not in a runnable status. The orchestrator marks the asset
    ``failed`` on error; we log and let the task surface the failure.
    """
    asset = MediaAsset.objects.filter(pk=asset_id).first()
    if asset is None:
        logger.warning("transcode_asset: asset %s not found; skipping", asset_id)
        return None
    if asset.status not in _RUNNABLE_STATUSES:
        logger.info(
            "transcode_asset: asset %s in status %s; skipping",
            asset_id,
            asset.status,
        )
        return None

    try:
        transcode_video(asset)
    except TranscodeError:
        logger.exception("transcode_asset: transcode failed for asset %s", asset_id)
        raise

    return str(asset.id)
