"""One-time-passcode services: request + verify.

Secrets handling: the 6-digit code is generated with :mod:`secrets` and is
**never persisted in plaintext**. Only its salted hash (via
:func:`django.contrib.auth.hashers.make_password`) is stored in
``Otp.code_hash``. :func:`request_otp` returns the raw code to its caller as a
transient tuple value so the (stubbed) delivery channel can send it; it is
neither logged at INFO nor written to the DB in the clear. Verification uses a
constant-time hash comparison and marks the code consumed on first success
(single-use).
"""
from __future__ import annotations

import logging
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from accounts.models import Otp

logger = logging.getLogger(__name__)

_CODE_DIGITS = 6
_OTP_TTL_SECONDS = 10 * 60


def _generate_code() -> str:
    """Return a zero-padded ``_CODE_DIGITS``-digit numeric code."""
    upper = 10**_CODE_DIGITS
    return str(secrets.randbelow(upper)).zfill(_CODE_DIGITS)


def _identifier_filter(email: str, phone: str) -> dict[str, str]:
    """Return the lookup kwargs matching whichever identifier was supplied."""
    if email:
        return {"email": email}
    if phone:
        return {"phone": phone}
    raise ValueError("An email or phone identifier is required.")


def request_otp(*, purpose: str, email: str = "", phone: str = "") -> tuple[Otp, str]:
    """Mint a code, store only its hash, and return ``(otp, raw_code)``.

    The raw code is returned so the caller can deliver it (stubbed). It is logged
    only at DEBUG to keep it out of production INFO logs.
    """
    if not email and not phone:
        raise ValueError("An email or phone identifier is required.")

    raw_code = _generate_code()
    otp = Otp.objects.create(
        purpose=purpose,
        email=email,
        phone=phone,
        code_hash=make_password(raw_code),
        expires_at=timezone.now() + timezone.timedelta(seconds=_OTP_TTL_SECONDS),
    )
    logger.debug("Issued OTP %s for purpose=%s", otp.id, purpose)
    return otp, raw_code


def verify_otp(*, purpose: str, code: str, email: str = "", phone: str = "") -> bool:
    """Verify ``code`` against the latest live OTP for the identifier.

    Returns ``True`` and marks the OTP consumed on the first correct match;
    returns ``False`` for a wrong code, an expired/consumed code, or no match.
    """
    lookup = _identifier_filter(email, phone)
    otp = (
        Otp.objects.filter(
            purpose=purpose,
            consumed=False,
            expires_at__gt=timezone.now(),
            **lookup,
        )
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        return False
    if not check_password(code, otp.code_hash):
        return False

    otp.consumed = True
    otp.save(update_fields=["consumed", "updated_at"])
    return True
