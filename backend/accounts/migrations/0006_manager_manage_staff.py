"""Grant ``manage-staff`` to the seeded manager system role.

Managers can now create staff and approve password changes (admin + manager).
The RBAC seed (0003) ran before this grant existed, so backfill it here.
Idempotent.
"""
from django.db import migrations


def grant_manager_manage_staff(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    manager = Role.objects.filter(org__isnull=True, key="manager").first()
    perm = Permission.objects.filter(key="manage-staff").first()
    if manager is None or perm is None:
        return
    RolePermission.objects.get_or_create(role=manager, permission=perm)


def revoke_manager_manage_staff(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")
    manager = Role.objects.filter(org__isnull=True, key="manager").first()
    if manager is not None:
        RolePermission.objects.filter(
            role=manager, permission_id="manage-staff"
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_passwordchangerequest"),
    ]

    operations = [
        migrations.RunPython(
            grant_manager_manage_staff, revoke_manager_manage_staff
        ),
    ]
