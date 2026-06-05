import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from accounts import constants
from accounts.managers import UserManager
from common.models import TimeStampedModel


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user keyed by username with a UUID primary key.

    Authentication is ``username`` + password; ``email`` is optional and used
    only for recovery. Login also accepts the email as the identifier via
    ``accounts.auth_backends.UsernameOrEmailBackend``. Multi-tenant
    membership/restaurant/org context is intentionally *not* stored on the
    user row -- it is attached via a separate ``Membership`` model and
    surfaced through JWT claims, keeping this model tenancy-agnostic.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(
        _("username"),
        max_length=150,
        unique=True,
        help_text=_("Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only."),
        validators=[UnicodeUsernameValidator()],
    )
    email = models.EmailField(
        _("email address"),
        unique=True,
        null=True,
        blank=True,
        help_text=_("Optional. Used for account recovery."),
    )
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into the admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["username"]

    def __str__(self):
        return self.username


# ── Control plane: organization → outlet → routing ──────────────────────────
class Organization(TimeStampedModel):
    """The billing + identity tenant. One owner / chain = one organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=120, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Restaurant(TimeStampedModel):
    """An outlet under an organization — the per-tenant ops boundary."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="restaurants"
    )
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=40, help_text="Outlet code, unique per org.")
    city = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    published = models.BooleanField(
        default=False, help_text="Guest-facing menu is live when published + paid."
    )
    active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["org", "code"], name="uniq_restaurant_org_code"),
        ]

    def __str__(self) -> str:
        return self.name


class TenantShard(models.Model):
    """Routing row: which physical DB connection a restaurant's data lives on.

    Defaults route every tenant to the shared ``pool-main`` connection. Promote
    an enterprise/chain/residency tenant by pointing ``connection_alias`` at a
    dedicated Django DB alias — no model/app change required (see
    ``common.routers.TenantShardRouter``).
    """

    restaurant = models.OneToOneField(
        Restaurant, on_delete=models.CASCADE, primary_key=True, related_name="shard"
    )
    shard = models.CharField(max_length=64, default="pool-main")
    region = models.CharField(max_length=32, default="ap-south-1")
    connection_alias = models.CharField(max_length=64, default="default")

    def __str__(self) -> str:
        return f"{self.restaurant_id} → {self.shard}"


# ── RBAC catalog ────────────────────────────────────────────────────────────
class Permission(models.Model):
    """A gated capability. Seeded from ``constants.PERMISSIONS``."""

    key = models.CharField(primary_key=True, max_length=40)
    label = models.CharField(max_length=120)
    category = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ["category", "key"]

    def __str__(self) -> str:
        return self.key


class Role(TimeStampedModel):
    """A named bundle of permissions. ``org = NULL`` marks a shared system role."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
        help_text="NULL = system role shared across all orgs.",
    )
    key = models.CharField(max_length=40)
    label = models.CharField(max_length=120)
    is_system = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=Q(org__isnull=True),
                name="uniq_system_role_key",
            ),
            models.UniqueConstraint(
                fields=["org", "key"],
                condition=Q(org__isnull=False),
                name="uniq_org_role_key",
            ),
        ]

    def __str__(self) -> str:
        return self.label

    def permission_keys(self) -> set[str]:
        return set(self.role_permissions.values_list("permission_id", flat=True))


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="uniq_role_permission"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.role_id}:{self.permission_id}"


# ── Membership (one people-model) ───────────────────────────────────────────
class Membership(TimeStampedModel):
    """Links an (optional) auth user to an org with a role.

    ``user`` is nullable so roster-only staff (a busser who never logs in, or an
    invited-but-not-yet-joined member) still exist as FK targets for orders.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships",
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="memberships")
    display_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    hue = models.PositiveSmallIntegerField(default=0)
    shift = models.CharField(max_length=8, blank=True)
    active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=16,
        choices=constants.MEMBERSHIP_STATUS_CHOICES,
        default=constants.MEMBERSHIP_ACTIVE,
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["display_name", "email"]
        constraints = [
            models.UniqueConstraint(
                fields=["org", "user"],
                condition=Q(user__isnull=False),
                name="uniq_membership_org_user",
            ),
        ]

    def __str__(self) -> str:
        return self.display_name or self.email or str(self.id)

    def effective_permission_keys(self) -> set[str]:
        """Role grants ∪ per-member adds − per-member revokes."""
        base = self.role.permission_keys() if self.role_id else set()
        add: set[str] = set()
        remove: set[str] = set()
        for override in self.permission_overrides.all():
            (add if override.granted else remove).add(override.permission_id)
        return (base | add) - remove


class MembershipOutlet(models.Model):
    """Assigns a membership to one outlet (a person can work ≥1 branch)."""

    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name="outlets"
    )
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name="staff_links"
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "restaurant"], name="uniq_membership_outlet"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.membership_id}@{self.restaurant_id}"


class MembershipPermission(models.Model):
    """Per-person permission delta vs. the role default (granted True=add/False=revoke)."""

    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name="permission_overrides"
    )
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "permission"], name="uniq_membership_permission"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.membership_id}:{self.permission_id}={self.granted}"


# ── Onboarding artefacts ────────────────────────────────────────────────────
class Invite(TimeStampedModel):
    """A pending staff invitation, redeemed to bind a user to a membership."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invites")
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name="invites",
        null=True,
        blank=True,
    )
    email = models.EmailField()
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=16,
        choices=constants.INVITE_STATUS_CHOICES,
        default=constants.INVITE_PENDING,
    )
    invited_by = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_invites",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"invite<{self.email}:{self.status}>"


class Otp(TimeStampedModel):
    """A one-time passcode for passwordless staff login / loyalty enrolment.

    The code is stored hashed; only the hash is compared. Single-use + expiring.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purpose = models.CharField(max_length=16, choices=constants.OTP_PURPOSE_CHOICES)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    consumed = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["purpose", "email"]),
            models.Index(fields=["purpose", "phone"]),
        ]

    def is_valid(self) -> bool:
        return not self.consumed and self.expires_at > timezone.now()


class PasswordChangeRequest(TimeStampedModel):
    """A staff member's pending password change, awaiting admin/manager approval.

    The proposed password is stored only as a Django password hash
    (``make_password``) -- never plaintext or anything reversible -- so an
    approver can apply it without ever seeing it. On approval the hash is copied
    straight onto the user's ``password`` column.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="password_change_requests",
    )
    requester = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name="password_requests"
    )
    new_password_hash = models.CharField(max_length=128)
    status = models.CharField(
        max_length=16,
        choices=constants.PWD_REQ_STATUS_CHOICES,
        default=constants.PWD_REQ_PENDING,
    )
    reviewed_by = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_password_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["org", "status"]),
        ]

    def __str__(self) -> str:
        return f"pwd-request<{self.requester_id}:{self.status}>"
