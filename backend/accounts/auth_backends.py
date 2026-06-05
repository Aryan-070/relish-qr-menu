"""Authentication backend that accepts a username *or* an email as the login id.

The custom ``User`` model authenticates by ``username``, but staff find it
convenient to sign in with their recovery email too. This backend resolves the
single ``username`` credential against either field, prefers an exact username
match on the rare collision, and runs a dummy password hash when no user is
found so response timing does not leak account existence.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.hashers import make_password

User = get_user_model()

# Pre-computed once at import: a valid hash to compare against on the miss path
# so a non-existent identifier costs the same as a wrong password.
_DUMMY_HASH = make_password("relish-dummy-password-for-timing")


class UsernameOrEmailBackend(ModelBackend):
    """Resolve the ``username`` credential as either a username or an email."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = username or kwargs.get("email")
        if identifier is None or password is None:
            return None

        # Username match wins over an email collision; fall back to email.
        user = User.objects.filter(username__iexact=identifier).first()
        if user is None:
            user = User.objects.filter(email__iexact=identifier).first()

        if user is None:
            # Equalise timing with the found-user path.
            make_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
