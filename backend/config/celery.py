"""Celery application (transcode, invite emails, loyalty expiry, usage rollups)."""
import logging
import os

from celery import Celery

logger = logging.getLogger(__name__)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("relish")
# Read config from Django settings, CELERY_-namespaced keys.
app.config_from_object("django.conf:settings", namespace="CELERY")
# Discover @shared_task across installed apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:  # pragma: no cover - operational smoke task
    logger.debug("Celery debug_task request: %r", self.request)
