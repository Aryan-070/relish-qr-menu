"""Abstract base models shared across every app.

``TimeStampedModel`` adds created/updated timestamps. ``TenantScopedModel``
builds on it to provide the multi-tenancy primitives: a UUID primary key, an
indexed ``restaurant_id`` for pooled scoping, soft-delete support, and the
tenant-aware default manager.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from common.managers import TenantManager


class TimeStampedModel(models.Model):
    """Abstract base adding self-managed ``created_at`` / ``updated_at``."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantScopedModel(TimeStampedModel):
    """Abstract base for every tenant-scoped model (pooled multi-tenancy).

    * ``id`` — UUID primary key (stable, non-enumerable across tenants).
    * ``restaurant_id`` — indexed tenant key used by ``TenantManager``.
    * ``deleted_at`` — soft-delete marker; ``None`` means active.

    Managers:

    * ``objects`` — :class:`~common.managers.TenantManager`, auto-scoped to the
      active tenant and excluding soft-deleted rows.
    * ``all_objects`` — a plain manager returning every row across all tenants,
      including soft-deleted ones (for admin, migrations, cross-tenant jobs).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant_id = models.UUIDField(db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = TenantManager()
    # ``all_objects`` is the unscoped escape hatch; ruff's DJ012 misreads the
    # bare ``models.Manager()`` as a field, hence the local ignore.
    all_objects = models.Manager()  # noqa: DJ012

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        """Mark this row deleted (set ``deleted_at=now``) and persist it."""
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])
