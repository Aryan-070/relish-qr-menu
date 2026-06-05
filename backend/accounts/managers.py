import re

from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _


def _derive_username(email: str) -> str:
    """Best-effort username from an email local-part (valid username chars)."""
    base = re.sub(r"[^A-Za-z0-9_.+-]", "", (email or "").split("@")[0])
    return base or "user"


class UserManager(BaseUserManager):
    """Manager for the username-based custom ``User`` model.

    ``username`` is the unique identifier used for authentication; ``email`` is
    optional (recovery only). Login also accepts the email as the identifier via
    ``accounts.auth_backends.UsernameOrEmailBackend``.

    For convenience, callers that supply only an ``email`` (legacy/test code,
    invite acceptance) get a ``username`` derived from the email local-part.
    Real staff creation always passes an explicit ``username``.
    """

    use_in_migrations = True

    def _create_user(self, username=None, email=None, password=None, **extra_fields):
        """Create and persist a user with the given username and password."""
        email = self.normalize_email(email) if email else None
        if not username:
            if not email:
                raise ValueError(_("Either a username or an email must be set."))
            username = _derive_username(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username=None, email=None, password=None, **extra_fields):
        """Create a standard (non-staff, non-superuser) user."""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username=None, email=None, password=None, **extra_fields):
        """Create a superuser with staff/superuser/active flags enabled."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))

        return self._create_user(username, email, password, **extra_fields)
