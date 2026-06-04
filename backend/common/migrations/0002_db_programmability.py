"""Database-side programmability for the ``relish`` schema.

Adds Postgres-native capability on top of the ORM — fuzzy-search + reporting
indexes, domain stored functions / a stored procedure, an ``updated_at``
safety-net trigger, and a lightweight row-audit trigger. All DDL is idempotent
(``IF [NOT] EXISTS`` / ``CREATE OR REPLACE``) and fully reversed, so the
migration is re-runnable and ``migrate common 0001`` cleanly tears it down.

Postgres-only: a no-op on SQLite (the local/test default), mirroring
``0001_rls_backstop``. Anchored on real columns of ``ops_order`` /
``ops_orderline`` / ``ops_orderlinemodifier`` / ``menu_menuitem``.

Design notes
------------
* The ``updated_at`` trigger is a *safety net*: it only stamps ``now()`` when
  the writer left ``updated_at`` untouched, so Django's ``auto_now`` value
  always wins and raw-SQL / bulk writes still get a fresh timestamp.
* ``relish_recompute_order`` is a true stored PROCEDURE (invoked via ``CALL``)
  that recomputes and persists an order's subtotal/total from its lines.
* The row-audit trigger records the active tenant from the ``app.current_restaurant``
  session GUC (set by ``common.middleware.TenantMiddleware``), the same GUC the
  RLS policies in ``0001_rls_backstop`` key on.
"""
from django.db import migrations

FORWARD_SQL = r"""
-- 1. Fuzzy menu search: trigram extension + GIN index on item names.
--    pg_trgm is a "trusted" extension (PG13+), so the non-superuser DB owner
--    may create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS menu_menuitem_name_trgm
    ON menu_menuitem USING gin (name gin_trgm_ops);

-- 2. Reporting index: open (unpaid, un-voided) orders by recency, per tenant.
CREATE INDEX IF NOT EXISTS ops_order_unpaid_idx
    ON ops_order (restaurant_id, placed_at DESC)
    WHERE paid = false AND voided = false;

-- 3. Tenant GUC helper — resolves the active restaurant from the session.
CREATE OR REPLACE FUNCTION current_restaurant() RETURNS uuid
    LANGUAGE sql STABLE AS $fn$
    SELECT NULLIF(current_setting('app.current_restaurant', true), '')::uuid;
$fn$;

-- 4. Recompute an order's subtotal from its lines + per-line modifiers.
CREATE OR REPLACE FUNCTION relish_order_subtotal(p_order uuid) RETURNS bigint
    LANGUAGE sql STABLE AS $fn$
    SELECT COALESCE(SUM(l.qty * (l.unit_price_minor + COALESCE(m.delta, 0))), 0)::bigint
    FROM ops_orderline l
    LEFT JOIN (
        SELECT order_line_id, SUM(price_delta_minor) AS delta
        FROM ops_orderlinemodifier
        GROUP BY order_line_id
    ) m ON m.order_line_id = l.id
    WHERE l.order_id = p_order;
$fn$;

-- 5. Stored PROCEDURE: recompute + persist subtotal/total on the order row.
CREATE OR REPLACE PROCEDURE relish_recompute_order(p_order uuid)
    LANGUAGE plpgsql AS $fn$
DECLARE
    v_subtotal bigint;
    v_discount_pct int;
    v_tax bigint;
BEGIN
    v_subtotal := relish_order_subtotal(p_order);
    SELECT discount_pct, tax_minor INTO v_discount_pct, v_tax
      FROM ops_order WHERE id = p_order;
    UPDATE ops_order
       SET subtotal_minor = v_subtotal,
           total_minor = v_subtotal
                         - (v_subtotal * COALESCE(v_discount_pct, 0) / 100)::bigint
                         + COALESCE(v_tax, 0)
     WHERE id = p_order;
END;
$fn$;

-- 6. Daily paid sales for a tenant (reporting helper).
CREATE OR REPLACE FUNCTION relish_daily_sales(p_restaurant uuid, p_day date)
    RETURNS bigint LANGUAGE sql STABLE AS $fn$
    SELECT COALESCE(SUM(total_minor), 0)::bigint
    FROM ops_order
    WHERE restaurant_id = p_restaurant
      AND paid = true AND voided = false
      AND (placed_at AT TIME ZONE 'UTC')::date = p_day;
$fn$;

-- 7. updated_at safety-net trigger — never overrides an explicit write.
CREATE OR REPLACE FUNCTION relish_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS touch_updated_at ON menu_menuitem;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON menu_menuitem
    FOR EACH ROW EXECUTE FUNCTION relish_touch_updated_at();
DROP TRIGGER IF EXISTS touch_updated_at ON ops_order;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON ops_order
    FOR EACH ROW EXECUTE FUNCTION relish_touch_updated_at();

-- 8. Lightweight row-audit table + AFTER trigger capturing the tenant GUC.
CREATE TABLE IF NOT EXISTS common_db_audit (
    id            bigserial PRIMARY KEY,
    table_name    text NOT NULL,
    row_id        text,
    op            text NOT NULL,
    restaurant_id text,
    changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS common_db_audit_table_time_idx
    ON common_db_audit (table_name, changed_at DESC);

CREATE OR REPLACE FUNCTION relish_audit_row() RETURNS trigger
    LANGUAGE plpgsql AS $fn$
DECLARE
    v_id  text;
    v_rid text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.id::text;  v_rid := OLD.restaurant_id::text;
    ELSE
        v_id := NEW.id::text;  v_rid := NEW.restaurant_id::text;
    END IF;
    INSERT INTO common_db_audit (table_name, row_id, op, restaurant_id)
    VALUES (TG_TABLE_NAME, v_id, TG_OP,
            COALESCE(NULLIF(current_setting('app.current_restaurant', true), ''), v_rid));
    RETURN NULL;
END;
$fn$;
DROP TRIGGER IF EXISTS audit_row ON ops_order;
CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON ops_order
    FOR EACH ROW EXECUTE FUNCTION relish_audit_row();
"""

REVERSE_SQL = r"""
DROP TRIGGER IF EXISTS audit_row ON ops_order;
DROP TRIGGER IF EXISTS touch_updated_at ON ops_order;
DROP TRIGGER IF EXISTS touch_updated_at ON menu_menuitem;
DROP FUNCTION IF EXISTS relish_audit_row();
DROP FUNCTION IF EXISTS relish_touch_updated_at();
DROP TABLE IF EXISTS common_db_audit;
DROP FUNCTION IF EXISTS relish_daily_sales(uuid, date);
DROP PROCEDURE IF EXISTS relish_recompute_order(uuid);
DROP FUNCTION IF EXISTS relish_order_subtotal(uuid);
DROP FUNCTION IF EXISTS current_restaurant();
DROP INDEX IF EXISTS ops_order_unpaid_idx;
DROP INDEX IF EXISTS menu_menuitem_name_trgm;
-- pg_trgm is intentionally left installed (may be relied on elsewhere).
"""


def apply(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    with conn.cursor() as cursor:
        cursor.execute(FORWARD_SQL)


def revert(apps, schema_editor):
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    with conn.cursor() as cursor:
        cursor.execute(REVERSE_SQL)


class Migration(migrations.Migration):
    # CREATE INDEX outside an atomic block keeps this safe to extend with
    # CONCURRENTLY later without a migration rewrite.
    atomic = False

    dependencies = [
        ("common", "0001_rls_backstop"),
        ("menu", "0001_initial"),
        ("ops", "0001_initial"),
    ]

    operations = [migrations.RunPython(apply, revert)]
