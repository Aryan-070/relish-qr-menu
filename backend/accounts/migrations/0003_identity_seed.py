"""Seed the RBAC catalog: permissions, system roles, and default grants.

Idempotent (uses update_or_create), so it is safe to re-run and to keep in sync
with accounts/constants.py.
"""
from django.db import migrations


def seed_rbac(apps, schema_editor):
    from accounts.constants import (
        PERMISSIONS,
        ROLE_DEFAULT_PERMISSIONS,
        ROLE_LABELS,
    )

    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")

    for key, label, category in PERMISSIONS:
        Permission.objects.update_or_create(
            key=key, defaults={"label": label, "category": category}
        )

    for key, label in ROLE_LABELS.items():
        role, _ = Role.objects.update_or_create(
            org=None, key=key, defaults={"label": label, "is_system": True}
        )
        wanted = ROLE_DEFAULT_PERMISSIONS.get(key, frozenset())
        RolePermission.objects.filter(role=role).delete()
        for permission_key in sorted(wanted):
            RolePermission.objects.create(role=role, permission_id=permission_key)


def unseed_rbac(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    Role.objects.filter(org__isnull=True, is_system=True).delete()
    Permission.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_membership_organization_permission_restaurant_role_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_rbac, unseed_rbac),
    ]
