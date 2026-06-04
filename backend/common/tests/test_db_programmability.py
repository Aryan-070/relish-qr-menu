"""Regression guard for ``common.0002_db_programmability``.

Asserts the Postgres-native objects (functions, stored procedure, triggers,
indexes) the migration installs exist and the pure helpers behave. Postgres-only
— skipped on the SQLite test default, where the migration is a documented no-op.
"""
import uuid

import pytest
from django.db import connection

pytestmark = [
    pytest.mark.django_db,
    pytest.mark.skipif(
        connection.vendor != "postgresql",
        reason="DB programmability is a Postgres-only migration",
    ),
]


def test_functions_and_procedure_exist():
    expected = {
        "current_restaurant",
        "relish_order_subtotal",
        "relish_recompute_order",
        "relish_daily_sales",
        "relish_touch_updated_at",
        "relish_audit_row",
    }
    with connection.cursor() as cur:
        cur.execute(
            "SELECT proname FROM pg_proc "
            "WHERE proname = ANY(%s)",
            [list(expected)],
        )
        found = {row[0] for row in cur.fetchall()}
    assert expected <= found, f"missing routines: {expected - found}"


def test_triggers_and_indexes_exist():
    with connection.cursor() as cur:
        cur.execute(
            "SELECT tgname, tgrelid::regclass::text FROM pg_trigger "
            "WHERE tgname IN ('touch_updated_at', 'audit_row')"
        )
        triggers = {(name, tbl) for name, tbl in cur.fetchall()}
        cur.execute(
            "SELECT indexname FROM pg_indexes "
            "WHERE indexname IN ('menu_menuitem_name_trgm', 'ops_order_unpaid_idx')"
        )
        indexes = {row[0] for row in cur.fetchall()}
    assert ("touch_updated_at", "menu_menuitem") in triggers
    assert ("touch_updated_at", "ops_order") in triggers
    assert ("audit_row", "ops_order") in triggers
    assert {"menu_menuitem_name_trgm", "ops_order_unpaid_idx"} <= indexes


def test_helpers_return_sane_defaults():
    rand = uuid.uuid4()
    with connection.cursor() as cur:
        # No lines / no orders → 0, never NULL.
        cur.execute("SELECT relish_order_subtotal(%s)", [rand])
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT relish_daily_sales(%s, CURRENT_DATE)", [rand])
        assert cur.fetchone()[0] == 0
        # current_restaurant() reflects the session GUC the RLS layer sets.
        cur.execute("SELECT set_config('app.current_restaurant', %s, true)", [str(rand)])
        cur.execute("SELECT current_restaurant()")
        assert cur.fetchone()[0] == rand
