"""Row-Level-Security backstop for the pooled multi-tenant schema.

Enables RLS + a tenant-isolation policy on every table carrying a
``restaurant_id`` column, keyed on the ``app.current_restaurant`` session GUC
that ``common.middleware.TenantMiddleware`` already sets per request. Tables are
discovered from ``information_schema`` so the policy auto-covers current and
future tenant tables.

Defense-in-depth only: the app-layer ``TenantManager`` + explicit
``restaurant_id`` filters remain the primary isolation gate. RLS is NOT forced
here, so the Django connection (table owner) is unaffected — the policy bites
only when the app connects as a non-owner least-privilege role AND
``ALTER TABLE … FORCE ROW LEVEL SECURITY`` is enabled (a documented deploy-time
hardening step; see docs/ARCHITECTURE/backend.md). Postgres-only; a no-op on
SQLite (local/test default).
"""
from django.db import migrations

_FIND_TENANT_TABLES = (
    "SELECT table_name FROM information_schema.columns "
    "WHERE table_schema = 'public' AND column_name = 'restaurant_id'"
)


def _tenant_tables(cursor):
    cursor.execute(_FIND_TENANT_TABLES)
    return sorted({row[0] for row in cursor.fetchall()})


def apply_rls(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    with conn.cursor() as cursor:
        for table in _tenant_tables(cursor):
            cursor.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')
            cursor.execute(f'DROP POLICY IF EXISTS tenant_isolation ON "{table}";')
            cursor.execute(
                f'CREATE POLICY tenant_isolation ON "{table}" USING ('
                "restaurant_id::text = current_setting('app.current_restaurant', true)"
                ");"
            )


def remove_rls(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    with conn.cursor() as cursor:
        for table in _tenant_tables(cursor):
            cursor.execute(f'DROP POLICY IF EXISTS tenant_isolation ON "{table}";')
            cursor.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY;')


class Migration(migrations.Migration):
    # Runs after every tenant table exists.
    dependencies = [
        ("menu", "0001_initial"),
        ("ops", "0001_initial"),
        ("crm", "0001_initial"),
        ("inventory", "0001_initial"),
        ("assets", "0001_initial"),
        ("theming", "0001_initial"),
    ]

    operations = [migrations.RunPython(apply_rls, remove_rls)]
