"""Tests for the tenant shard DB router.

The router must be inert in Phase 1 (only ``default`` configured) and must
NEVER query the database during routing — a router that queried would recurse.
"""
from __future__ import annotations

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from common.context import reset_current_tenant, set_current_tenant
from common.routers import (
    TenantShardRouter,
    register_shard,
    unregister_shard,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def router():
    return TenantShardRouter()


@pytest.fixture
def model():
    # Any concrete model works; the router only inspects context + settings.
    from django.contrib.auth import get_user_model

    return get_user_model()


@pytest.fixture(autouse=True)
def _clean_registry():
    """Ensure each test tears down the shard ids it may register."""
    yield
    unregister_shard("rest-1")
    unregister_shard("rest-2")


# --- inert with no registered shards ----------------------------------------


def test_db_for_read_none_without_shards(router, model):
    assert router.db_for_read(model) is None


def test_db_for_write_none_without_shards(router, model):
    assert router.db_for_write(model) is None


def test_db_for_read_none_when_tenant_bound_but_unregistered(router, model):
    token = set_current_tenant("rest-1", "org-1")
    try:
        assert router.db_for_read(model) is None
    finally:
        reset_current_tenant(token)


# --- registered shard with an alias NOT in settings.DATABASES is ignored -----


def test_registered_but_unconfigured_alias_returns_none(router, model):
    register_shard("rest-1", "pool-shard-eu")  # not in settings.DATABASES
    token = set_current_tenant("rest-1", "org-1")
    try:
        assert router.db_for_read(model) is None
        assert router.db_for_write(model) is None
    finally:
        reset_current_tenant(token)


def test_default_alias_registration_is_treated_as_none(router, model):
    register_shard("rest-2", "default")
    token = set_current_tenant("rest-2", "org-2")
    try:
        assert router.db_for_read(model) is None
    finally:
        reset_current_tenant(token)


# --- allow_migrate ----------------------------------------------------------


def test_allow_migrate_default_is_truthy(router):
    # None means "no opinion → run", which is truthy-by-default for migrations.
    assert router.allow_migrate("default", "accounts") is None


def test_allow_migrate_unregistered_alias_is_rejected(router):
    assert router.allow_migrate("pool-shard-eu", "accounts") is False


def test_allow_migrate_registered_alias_runs(router):
    register_shard("rest-1", "pool-shard-eu")
    assert router.allow_migrate("pool-shard-eu", "accounts") is None


# --- allow_relation ---------------------------------------------------------


def test_allow_relation_same_db(router):
    from types import SimpleNamespace

    a = SimpleNamespace(_state=SimpleNamespace(db="default"))
    b = SimpleNamespace(_state=SimpleNamespace(db="default"))
    assert router.allow_relation(a, b) is True


def test_allow_relation_cross_db_defers(router):
    from types import SimpleNamespace

    a = SimpleNamespace(_state=SimpleNamespace(db="default"))
    b = SimpleNamespace(_state=SimpleNamespace(db="other"))
    assert router.allow_relation(a, b) is None


# --- hot-path safety: routing issues ZERO DB queries ------------------------


def test_routing_issues_no_db_queries(router, model):
    register_shard("rest-1", "pool-shard-eu")
    token = set_current_tenant("rest-1", "org-1")
    try:
        with CaptureQueriesContext(connection) as ctx:
            router.db_for_read(model)
            router.db_for_write(model)
            router.allow_migrate("default", "accounts")
            router.allow_migrate("pool-shard-eu", "accounts")
        assert len(ctx) == 0
    finally:
        reset_current_tenant(token)
