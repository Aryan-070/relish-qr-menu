"""The seed_demo command creates a fully-public demo restaurant, idempotently."""
import pytest
from django.core.management import call_command

from accounts.models import Restaurant
from billing.models import Subscription
from menu.models import MenuItem
from public.services import is_restaurant_public

pytestmark = pytest.mark.django_db


def test_seed_demo_creates_public_restaurant():
    call_command("seed_demo")

    restaurant = Restaurant.objects.get(published=True)
    assert Subscription.objects.filter(
        org_id=restaurant.org_id, status=Subscription.Status.ACTIVE
    ).exists()
    items = MenuItem.all_objects.filter(
        restaurant_id=restaurant.id, deleted_at__isnull=True
    )
    assert items.count() >= 25
    assert all(it.available for it in items)
    # The whole point: the public guest menu is now servable.
    assert is_restaurant_public(restaurant) is True


def test_seed_demo_is_idempotent():
    call_command("seed_demo")
    restaurant = Restaurant.objects.get(published=True)
    first = MenuItem.all_objects.filter(restaurant_id=restaurant.id).count()

    call_command("seed_demo")  # second run must not duplicate
    second = MenuItem.all_objects.filter(restaurant_id=restaurant.id).count()
    assert first == second
    assert Restaurant.objects.filter(published=True).count() == 1
