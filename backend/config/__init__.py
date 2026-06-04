"""Config package.

Importing the Celery app here ensures the shared task registry is loaded when
Django starts, so ``@shared_task`` decorators bind to the configured app.
"""
from .celery import app as celery_app

__all__ = ("celery_app",)
