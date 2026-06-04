"""Org provisioning: stand up a fresh tenant for a brand-new owner.

``provision_org`` is the single entry point used by the self-serve sign-up flow
(``ProvisionOrgView``). It is idempotent — a user who already owns an active
membership gets that membership back untouched, so retried requests never create
duplicate orgs/outlets.
"""
from __future__ import annotations

from django.db import transaction
from django.utils.text import slugify

from accounts.constants import MEMBERSHIP_ACTIVE, ROLE_ADMIN
from accounts.models import (
    Membership,
    MembershipOutlet,
    Organization,
    Restaurant,
    Role,
    TenantShard,
)


def _unique_slug(name: str) -> str:
    """Return a slug for ``name`` that is unique across organizations.

    Falls back to ``"org"`` for empty/symbol-only names, then de-duplicates by
    appending a numeric suffix (``-2``, ``-3``, …) until free.
    """
    base = slugify(name) or "org"
    slug = base
    suffix = 2
    while Organization.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def _unique_outlet_code(org: Organization) -> str:
    """Return an outlet code (``OUT-1``, ``OUT-2``, …) unique within ``org``."""
    index = 1
    code = f"OUT-{index}"
    while Restaurant.objects.filter(org=org, code=code).exists():
        index += 1
        code = f"OUT-{index}"
    return code


def provision_org(
    user, org_name: str, restaurant_name: str, city: str = ""
) -> Membership:
    """Provision an organization, first outlet, and admin membership for ``user``.

    Idempotent: if ``user`` already has an active membership, it is returned
    unchanged and nothing new is created. Otherwise a full tenant is created
    atomically:

    * ``Organization`` with a unique slug derived from ``org_name``
    * ``Restaurant`` (first outlet) with a per-org-unique code
    * ``TenantShard`` routing row (pooled defaults)
    * admin ``Membership`` bound to ``user`` (system admin role)
    * primary ``MembershipOutlet`` linking the membership to the outlet
    """
    existing = (
        Membership.objects.filter(
            user=user, status=MEMBERSHIP_ACTIVE, active=True
        )
        .select_related("org", "role")
        .first()
    )
    if existing is not None:
        return existing

    admin_role = Role.objects.get(key=ROLE_ADMIN, org__isnull=True)

    with transaction.atomic():
        org = Organization.objects.create(
            name=org_name, slug=_unique_slug(org_name)
        )
        restaurant = Restaurant.objects.create(
            org=org,
            name=restaurant_name,
            code=_unique_outlet_code(org),
            city=city,
        )
        TenantShard.objects.create(restaurant=restaurant)
        membership = Membership.objects.create(
            org=org,
            user=user,
            role=admin_role,
            display_name=user.email,
            email=user.email,
            status=MEMBERSHIP_ACTIVE,
            active=True,
        )
        MembershipOutlet.objects.create(
            membership=membership, restaurant=restaurant, is_primary=True
        )

    return membership
