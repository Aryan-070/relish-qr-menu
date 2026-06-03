"""Staff lifecycle services: invite, accept, permission deltas, deactivation.

These functions are the single write path for the staff-management endpoints
(``accounts.staff_views``). They own their own transactions so a partial failure
(e.g. an outlet that does not belong to the org) never leaves a dangling
``Membership`` without its ``Invite``.

Secrets handling: invite tokens are minted with :func:`secrets.token_urlsafe`
(cryptographically strong, URL-safe) and only ever stored in the unique
``Invite.token`` column. No raw OTP or password material is persisted here.
"""
from __future__ import annotations

import secrets
from collections.abc import Iterable

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.constants import (
    INVITE_ACCEPTED,
    INVITE_PENDING,
    MEMBERSHIP_ACTIVE,
    MEMBERSHIP_INVITED,
    MEMBERSHIP_SUSPENDED,
    PERMISSION_KEYS,
)
from accounts.models import (
    Invite,
    Membership,
    MembershipOutlet,
    MembershipPermission,
    Organization,
    Permission,
    Restaurant,
    Role,
)

User = get_user_model()

_INVITE_TOKEN_BYTES = 32


class StaffError(Exception):
    """Base class for staff-service domain errors."""


class InviteError(StaffError):
    """Raised when an invite cannot be created or redeemed."""


def _system_role(role_key: str) -> Role:
    """Return the shared (``org IS NULL``) system role for ``role_key``."""
    try:
        return Role.objects.get(key=role_key, org__isnull=True)
    except Role.DoesNotExist as exc:
        raise StaffError(f"Unknown role: {role_key!r}.") from exc


@transaction.atomic
def invite_staff(
    *,
    org: Organization,
    email: str,
    role_key: str,
    invited_by: Membership | None = None,
    outlet_ids: Iterable[str] | None = None,
) -> Invite:
    """Create an invited ``Membership`` + pending ``Invite`` for ``email``.

    The membership starts with no auth ``user`` and ``status=INVITED``; it is
    bound to a real user only when the invite is accepted. ``outlet_ids`` (if
    given) are validated to belong to ``org`` and linked, the first one primary.

    Returns the created :class:`Invite`. Email delivery is intentionally
    stubbed — TODO(Phase 4): enqueue a Celery task to send the invite email.
    """
    role = _system_role(role_key)

    membership = Membership.objects.create(
        org=org,
        user=None,
        role=role,
        display_name=email,
        email=email,
        status=MEMBERSHIP_INVITED,
        active=True,
    )

    outlet_id_list = list(outlet_ids or [])
    if outlet_id_list:
        outlets = list(
            Restaurant.objects.filter(id__in=outlet_id_list, org=org)
        )
        if len(outlets) != len(set(outlet_id_list)):
            raise InviteError("One or more outlets do not belong to this organization.")
        MembershipOutlet.objects.bulk_create(
            [
                MembershipOutlet(
                    membership=membership,
                    restaurant=outlet,
                    is_primary=(index == 0),
                )
                for index, outlet in enumerate(outlets)
            ]
        )

    invite = Invite.objects.create(
        org=org,
        membership=membership,
        email=email,
        role=role,
        token=secrets.token_urlsafe(_INVITE_TOKEN_BYTES),
        status=INVITE_PENDING,
        invited_by=invited_by,
    )
    return invite


@transaction.atomic
def accept_invite(*, token: str, password: str) -> Membership:
    """Redeem a pending invite: bind/create the user and activate the member.

    Raises :class:`InviteError` if the token is unknown, already used/revoked,
    or the invite has no membership to bind. Creates the user via
    ``create_user`` (hashing the password) when one does not yet exist for the
    invite email, then flips the membership to ACTIVE.
    """
    try:
        invite = (
            # of=("self",) locks only the invite row — Postgres rejects FOR
            # UPDATE on the nullable side of the membership LEFT JOIN otherwise.
            Invite.objects.select_for_update(of=("self",))
            .select_related("membership")
            .get(token=token, status=INVITE_PENDING)
        )
    except Invite.DoesNotExist as exc:
        raise InviteError("Invalid or already-used invite token.") from exc

    membership = invite.membership
    if membership is None:
        raise InviteError("Invite is not bound to a membership.")

    user = User.objects.filter(email=invite.email).first()
    if user is None:
        user = User.objects.create_user(email=invite.email, password=password)

    membership.user = user
    membership.status = MEMBERSHIP_ACTIVE
    membership.active = True
    membership.save(update_fields=["user", "status", "active", "updated_at"])

    invite.status = INVITE_ACCEPTED
    invite.accepted_at = timezone.now()
    invite.save(update_fields=["status", "accepted_at", "updated_at"])

    return membership


@transaction.atomic
def set_membership_permissions(
    membership: Membership,
    *,
    add: Iterable[str] = (),
    revoke: Iterable[str] = (),
) -> None:
    """Upsert per-member permission overrides (granted True=add / False=revoke).

    Validates every key against :data:`PERMISSION_KEYS`. ``add`` and ``revoke``
    are applied as ``update_or_create`` so a key flipping sides is rewritten in
    place rather than duplicated.
    """
    add_keys = list(add)
    revoke_keys = list(revoke)
    invalid = [k for k in (*add_keys, *revoke_keys) if k not in PERMISSION_KEYS]
    if invalid:
        raise StaffError(f"Unknown permission keys: {sorted(set(invalid))}.")

    for key, granted in ((k, True) for k in add_keys):
        MembershipPermission.objects.update_or_create(
            membership=membership,
            permission=Permission.objects.get(pk=key),
            defaults={"granted": granted},
        )
    for key in revoke_keys:
        MembershipPermission.objects.update_or_create(
            membership=membership,
            permission=Permission.objects.get(pk=key),
            defaults={"granted": False},
        )


def deactivate_membership(membership: Membership) -> None:
    """Suspend a membership (``status=SUSPENDED``, ``active=False``).

    Note: token-blacklist revocation of any live session lands in a later
    increment, once refresh tokens are tracked per session.
    """
    membership.status = MEMBERSHIP_SUSPENDED
    membership.active = False
    membership.save(update_fields=["status", "active", "updated_at"])
