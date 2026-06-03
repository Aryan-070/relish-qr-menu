"""Tenant-aware and soft-delete model managers.

``TenantManager`` is the default manager for every tenant-scoped model. It reads
the active tenant from :mod:`common.context` and transparently filters the
queryset to that ``restaurant_id`` while excluding soft-deleted rows.

Scoping policy:

* **Tenant bound** (normal request): rows are filtered to
  ``restaurant_id == get_current_restaurant_id()`` AND ``deleted_at IS NULL``.
* **No tenant bound** (shell, migrations, management commands, system jobs):
  we do NOT filter by tenant — returning an empty queryset everywhere would
  break admin/migrations. We still exclude soft-deleted rows. Use
  ``Model.all_objects`` (a plain ``Manager``) when you genuinely need every row
  across all tenants including deleted ones.
"""
from __future__ import annotations

from django.db import models

from common.context import get_current_restaurant_id


class SoftDeleteManager(models.Manager):
    """Manager that hides soft-deleted rows (``deleted_at IS NOT NULL``)."""

    def get_queryset(self) -> models.QuerySet:
        return super().get_queryset().filter(deleted_at__isnull=True)


class TenantManager(models.Manager):
    """Auto-scope querysets to the active tenant and hide soft-deleted rows."""

    def get_queryset(self) -> models.QuerySet:
        queryset = super().get_queryset().filter(deleted_at__isnull=True)
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is not None:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        return queryset

    def unscoped(self) -> models.QuerySet:
        """Return every row, ignoring tenant scope and soft-delete filtering."""
        return super().get_queryset()
