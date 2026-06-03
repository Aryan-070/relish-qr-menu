"""Proof that the Postgres RLS backstop isolates tenants by the session GUC.

Skipped on SQLite (RLS is Postgres-only). RLS never applies to superusers or the
table owner, so the test creates a plain non-privileged role, ``SET ROLE``s to
it (exactly how the app should connect in production for the backstop to bite),
drives the ``app.current_restaurant`` GUC, and asserts only matching rows are
visible. Everything runs inside the test transaction and is rolled back.
"""
import uuid

import pytest
from django.db import connection

from menu.models import MenuCategory

pytestmark = pytest.mark.django_db


@pytest.mark.skipif(
    connection.vendor != "postgresql", reason="RLS is a Postgres-only backstop"
)
def test_rls_isolates_rows_for_a_non_privileged_role():
    rid_a = uuid.uuid4()
    rid_b = uuid.uuid4()
    MenuCategory.all_objects.create(restaurant_id=rid_a, code="a", name="A")
    MenuCategory.all_objects.create(restaurant_id=rid_b, code="b", name="B")

    with connection.cursor() as cur:
        # A non-superuser, non-owner role IS subject to RLS once it's enabled
        # (which the 0001_rls_backstop migration did). Created in-txn → rolled back.
        cur.execute("DROP ROLE IF EXISTS rls_probe;")
        cur.execute("CREATE ROLE rls_probe NOLOGIN;")
        cur.execute("GRANT USAGE ON SCHEMA public TO rls_probe;")
        cur.execute("GRANT SELECT ON menu_menucategory TO rls_probe;")
        try:
            cur.execute("SET ROLE rls_probe;")

            cur.execute(
                "SELECT set_config('app.current_restaurant', %s, false)", [str(rid_a)]
            )
            cur.execute("SELECT count(*) FROM menu_menucategory;")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT restaurant_id FROM menu_menucategory;")
            assert str(cur.fetchone()[0]) == str(rid_a)

            cur.execute(
                "SELECT set_config('app.current_restaurant', %s, false)", [str(rid_b)]
            )
            cur.execute("SELECT count(*) FROM menu_menucategory;")
            assert cur.fetchone()[0] == 1

            # No tenant bound → the policy hides every row.
            cur.execute("SELECT set_config('app.current_restaurant', '', false)")
            cur.execute("SELECT count(*) FROM menu_menucategory;")
            assert cur.fetchone()[0] == 0
        finally:
            cur.execute("RESET ROLE;")
