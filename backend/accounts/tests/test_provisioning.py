import pytest
from django.contrib.auth import get_user_model

from accounts.constants import (
    MEMBERSHIP_ACTIVE,
    PERMISSION_KEYS,
    ROLE_ADMIN,
)
from accounts.models import (
    Membership,
    MembershipOutlet,
    Organization,
    Restaurant,
    TenantShard,
)
from accounts.services.provisioning import provision_org

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


@pytest.fixture
def user():
    return User.objects.create_user(email="owner@relish.test", password=VALID_PASSWORD)


def test_provision_org_creates_full_tenant(user):
    membership = provision_org(user, "Spice Route", "Spice Route Bandra", city="Mumbai")

    # Organization.
    org = Organization.objects.get(name="Spice Route")
    assert org.slug == "spice-route"

    # Restaurant + shard.
    restaurant = Restaurant.objects.get(org=org)
    assert restaurant.name == "Spice Route Bandra"
    assert restaurant.code == "OUT-1"
    assert restaurant.city == "Mumbai"
    shard = TenantShard.objects.get(restaurant=restaurant)
    assert shard.shard == "pool-main"
    assert shard.connection_alias == "default"

    # Admin membership bound to the user.
    assert membership.org_id == org.id
    assert membership.user_id == user.id
    assert membership.role.key == ROLE_ADMIN
    assert membership.status == MEMBERSHIP_ACTIVE
    assert membership.active is True
    assert membership.display_name == user.email

    # Primary outlet link.
    outlet = MembershipOutlet.objects.get(membership=membership)
    assert outlet.restaurant_id == restaurant.id
    assert outlet.is_primary is True


def test_provision_org_admin_has_all_permissions(user):
    membership = provision_org(user, "Spice Route", "Spice Route Bandra")
    assert membership.effective_permission_keys() == set(PERMISSION_KEYS)
    assert len(PERMISSION_KEYS) == 10


def test_provision_org_is_idempotent(user):
    first = provision_org(user, "Spice Route", "Spice Route Bandra")
    second = provision_org(user, "A Totally Different Name", "Other Outlet")

    # Same membership returned; no duplicate org/restaurant/outlet created.
    assert second.id == first.id
    assert Organization.objects.count() == 1
    assert Restaurant.objects.count() == 1
    assert Membership.objects.filter(user=user).count() == 1
    assert MembershipOutlet.objects.count() == 1


def test_provision_org_dedupes_slug_across_orgs():
    user_a = User.objects.create_user(email="a@relish.test", password=VALID_PASSWORD)
    user_b = User.objects.create_user(email="b@relish.test", password=VALID_PASSWORD)

    provision_org(user_a, "Spice Route", "Outlet A")
    provision_org(user_b, "Spice Route", "Outlet B")

    slugs = set(Organization.objects.values_list("slug", flat=True))
    assert slugs == {"spice-route", "spice-route-2"}
