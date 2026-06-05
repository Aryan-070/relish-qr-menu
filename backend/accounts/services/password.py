"""Password-change-with-approval services.

A staff member (typically a waiter) requests a new password; the proposed value
is stored only as a Django hash via :func:`make_password`. An admin/manager then
approves (the hash is copied onto the user and their refresh tokens revoked) or
rejects. Admins/managers may also reset a member's password directly, subject to
the same role-escalation guard as staff creation.
"""
from __future__ import annotations

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from accounts.constants import (
    PWD_REQ_APPROVED,
    PWD_REQ_PENDING,
    PWD_REQ_REJECTED,
)
from accounts.models import Membership, PasswordChangeRequest
from accounts.services.staff import (
    StaffError,
    assert_can_assign_role,
    blacklist_user_tokens,
)


@transaction.atomic
def request_password_change(
    *, membership: Membership, new_password: str
) -> PasswordChangeRequest:
    """Open a pending password-change request for ``membership``.

    Only one open request per member at a time. ``new_password`` is assumed to
    have already passed Django's validators at the serializer boundary.
    """
    if PasswordChangeRequest.objects.filter(
        requester=membership, status=PWD_REQ_PENDING
    ).exists():
        raise StaffError("You already have a pending password-change request.")
    return PasswordChangeRequest.objects.create(
        org=membership.org,
        requester=membership,
        new_password_hash=make_password(new_password),
        status=PWD_REQ_PENDING,
    )


@transaction.atomic
def approve_password_change(
    *, pcr: PasswordChangeRequest, reviewer_membership: Membership | None
) -> PasswordChangeRequest:
    """Apply a pending request's hash to the user and revoke their sessions."""
    if pcr.status != PWD_REQ_PENDING:
        raise StaffError("This request is no longer pending.")
    user = pcr.requester.user
    if user is None:
        raise StaffError("The requester has no login account.")

    # The stored value is already a Django password hash -- assign it directly.
    user.password = pcr.new_password_hash
    user.save(update_fields=["password"])
    blacklist_user_tokens(user)

    pcr.status = PWD_REQ_APPROVED
    pcr.reviewed_by = reviewer_membership
    pcr.reviewed_at = timezone.now()
    pcr.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return pcr


@transaction.atomic
def reject_password_change(
    *,
    pcr: PasswordChangeRequest,
    reviewer_membership: Membership | None,
    reason: str = "",
) -> PasswordChangeRequest:
    """Reject a pending password-change request."""
    if pcr.status != PWD_REQ_PENDING:
        raise StaffError("This request is no longer pending.")
    pcr.status = PWD_REQ_REJECTED
    pcr.reviewed_by = reviewer_membership
    pcr.reviewed_at = timezone.now()
    pcr.reason = reason
    pcr.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "reason", "updated_at"]
    )
    return pcr


@transaction.atomic
def admin_reset_password(
    *,
    target_membership: Membership,
    new_password: str,
    reviewer_membership: Membership | None,
    caller_role_key: str | None,
    caller_is_superuser: bool = False,
) -> None:
    """Directly reset a member's password (no approval needed).

    Escalation-guarded: a manager cannot reset an admin's password.
    """
    target_role_key = (
        target_membership.role.key if target_membership.role_id else ""
    )
    assert_can_assign_role(
        caller_role_key, target_role_key, is_superuser=caller_is_superuser
    )
    user = target_membership.user
    if user is None:
        raise StaffError("This member has no login account.")
    user.set_password(new_password)
    user.save(update_fields=["password"])
    blacklist_user_tokens(user)
