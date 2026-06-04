"""Tenant shard DB router.

Routes a promoted tenant's data-plane queries to its dedicated DB connection
(per ``accounts.models.TenantShard.connection_alias``). In Phase 1 only the
``default`` connection exists, so this router is **inert**: it returns ``None``
(Django default routing) for every model.

Hot-path safety (CRITICAL): a database router runs inside the query machinery.
If a router queried the DB during routing it would recurse infinitely. Therefore
this router NEVER touches the database. It resolves a tenant's alias purely from
an in-process registry populated by :func:`register_shard` — the extension point
Phase 7 uses to promote a tenant to a dedicated connection without a code change
(promotion code reads ``TenantShard`` once and calls ``register_shard`` to warm
the registry; the router only ever consults the in-memory dict).

A resolved alias is honoured only when it is actually present in
``settings.DATABASES``; otherwise the router falls back to ``None`` so a stale or
not-yet-configured alias can never break a request.
"""
from __future__ import annotations

from threading import RLock
from typing import Any

from django.conf import settings

from common.context import get_current_restaurant_id

# In-process registry: restaurant_id (str) -> Django DB alias (str). Consulted
# on every read/write routing decision; never persisted, never queried from DB.
_SHARD_REGISTRY: dict[str, str] = {}
_REGISTRY_LOCK = RLock()

DEFAULT_ALIAS = "default"


def register_shard(restaurant_id: Any, alias: str) -> None:
    """Register ``restaurant_id`` → ``alias`` in the in-process shard registry.

    Idempotent. Both values are coerced to ``str``. Phase 7 promotion calls this
    (e.g. on app warm-up or after promoting a tenant) so the router can route the
    tenant's queries to a dedicated connection without ever hitting the DB.
    """
    with _REGISTRY_LOCK:
        _SHARD_REGISTRY[str(restaurant_id)] = str(alias)


def unregister_shard(restaurant_id: Any) -> None:
    """Remove ``restaurant_id`` from the registry (no error if absent)."""
    with _REGISTRY_LOCK:
        _SHARD_REGISTRY.pop(str(restaurant_id), None)


def registered_aliases() -> frozenset[str]:
    """Return the set of non-default aliases currently registered."""
    with _REGISTRY_LOCK:
        return frozenset(_SHARD_REGISTRY.values())


def _is_configured(alias: str) -> bool:
    """True when ``alias`` is a real connection in ``settings.DATABASES``."""
    return alias in settings.DATABASES


class TenantShardRouter:
    """Route promoted tenants to dedicated DB aliases; inert otherwise."""

    def _alias_for_current_tenant(self) -> str | None:
        """Resolve the active tenant's DB alias from the in-memory registry.

        Returns ``None`` (use Django's default routing) when no tenant is bound,
        the tenant has no registered shard, the alias is ``default``, or the
        resolved alias is not configured in ``settings.DATABASES``. NEVER queries
        the database.
        """
        restaurant_id = get_current_restaurant_id()
        if restaurant_id is None:
            return None
        with _REGISTRY_LOCK:
            alias = _SHARD_REGISTRY.get(str(restaurant_id))
        if not alias or alias == DEFAULT_ALIAS:
            return None
        if not _is_configured(alias):
            return None
        return alias

    def db_for_read(self, model: Any, **hints: Any) -> str | None:
        return self._alias_for_current_tenant()

    def db_for_write(self, model: Any, **hints: Any) -> str | None:
        return self._alias_for_current_tenant()

    def allow_relation(self, obj1: Any, obj2: Any, **hints: Any) -> bool | None:
        """Allow relations between objects sharing a database state.

        Returns ``True`` when both objects come from the same connection,
        otherwise ``None`` to defer to Django / other routers.
        """
        state1 = getattr(obj1, "_state", None)
        state2 = getattr(obj2, "_state", None)
        if state1 is None or state2 is None:
            return None
        if state1.db == state2.db:
            return True
        return None

    def allow_migrate(
        self, db: str, app_label: str, **hints: Any
    ) -> bool | None:
        """Apply every app's migrations to ``default`` and to registered shards.

        ``default`` and any alias registered via :func:`register_shard` are full
        replicas (same schema), so migrations run there. Any other (unregistered)
        non-default alias is rejected so stray connections never get migrated.
        Consults only the in-memory registry — never the database.
        """
        if db == DEFAULT_ALIAS:
            return None
        if db in registered_aliases():
            return None
        return False
