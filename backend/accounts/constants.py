"""RBAC catalog: the permission set and the default role→permission grants.

These are the single source of truth seeded into the DB by the data migration
(``0002_identity_seed``) and referenced by ``provision_org`` and the staff
management endpoints. The permission keys mirror the original TypeScript
``Permission`` union from the demo console (``src/console/lib/types.ts``).
"""
from __future__ import annotations

# (key, human label, category)
PERMISSIONS: tuple[tuple[str, str, str], ...] = (
    ("void", "Void orders", "ops"),
    ("comp", "Comp / on-the-house", "ops"),
    ("discount", "Apply discounts", "ops"),
    ("refund", "Refund payments", "ops"),
    ("edit-menu", "Edit menu items, prices, photos", "menu"),
    ("manage-stock", "Manage inventory & 86", "inventory"),
    ("manage-staff", "Manage roster & access", "admin"),
    ("view-reports", "View analytics & sales", "admin"),
    ("manage-billing", "Manage subscription & invoices", "admin"),
    ("manage-theme", "Edit branding & theme", "admin"),
)

PERMISSION_KEYS: tuple[str, ...] = tuple(p[0] for p in PERMISSIONS)

# System roles (org = NULL). Orgs may add custom roles later (Phase 7).
ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_WAITER = "waiter"
ROLE_KITCHEN = "kitchen"
ROLE_HOST = "host"

ROLE_LABELS: dict[str, str] = {
    ROLE_ADMIN: "Admin",
    ROLE_MANAGER: "Manager",
    ROLE_WAITER: "Waiter",
    ROLE_KITCHEN: "Kitchen",
    ROLE_HOST: "Host",
}

# Default gated-permission grants per system role. admin = all; manager = most
# (no staff/billing control); waiter/kitchen/host = none of the gated actions
# (their everyday operations are not permission-gated).
ROLE_DEFAULT_PERMISSIONS: dict[str, frozenset[str]] = {
    ROLE_ADMIN: frozenset(PERMISSION_KEYS),
    ROLE_MANAGER: frozenset(
        {
            "void",
            "comp",
            "discount",
            "refund",
            "edit-menu",
            "manage-stock",
            "view-reports",
            "manage-theme",
        }
    ),
    ROLE_WAITER: frozenset(),
    ROLE_KITCHEN: frozenset(),
    ROLE_HOST: frozenset(),
}

# Membership lifecycle states.
MEMBERSHIP_ACTIVE = "active"
MEMBERSHIP_INVITED = "invited"
MEMBERSHIP_SUSPENDED = "suspended"
MEMBERSHIP_STATUS_CHOICES = (
    (MEMBERSHIP_ACTIVE, "Active"),
    (MEMBERSHIP_INVITED, "Invited"),
    (MEMBERSHIP_SUSPENDED, "Suspended"),
)

# Invite lifecycle.
INVITE_PENDING = "pending"
INVITE_ACCEPTED = "accepted"
INVITE_REVOKED = "revoked"
INVITE_STATUS_CHOICES = (
    (INVITE_PENDING, "Pending"),
    (INVITE_ACCEPTED, "Accepted"),
    (INVITE_REVOKED, "Revoked"),
)

# OTP purposes.
OTP_LOGIN = "login"
OTP_LOYALTY = "loyalty"
OTP_PURPOSE_CHOICES = (
    (OTP_LOGIN, "Staff login"),
    (OTP_LOYALTY, "Loyalty enrolment"),
)
