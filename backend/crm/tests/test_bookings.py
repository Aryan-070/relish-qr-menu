"""Bookings + feedback slice API tests: reservations, waitlist, feedback.

Auth runs end to end through the JWT: tokens carry ``restaurant_id`` / ``org_id``
/ ``membership_id`` claims, and ``common.middleware.TenantMiddleware`` decodes the
``Authorization: Bearer`` header to bind the active tenant. We set credentials
with a real signed token (not ``force_authenticate``) so the middleware runs and
scoping/membership context are genuinely exercised.

Coverage:

* Reservations — create (scoped to the caller's restaurant), a ``booked →
  seated`` transition, and cross-tenant isolation (restaurant B never sees A's).
* Waitlist — create plus ``notify``/``seat`` transitions.
* Feedback — create with a valid rating, rejection of an out-of-range rating
  (error surfaced under ``resp.data["detail"]``), and newest-first listing.
"""
from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Membership, Organization, Restaurant, Role
from crm.models import Feedback, Reservation, WaitlistEntry

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# --- Fixtures / helpers ------------------------------------------------------


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _make_membership(org: Organization, *, email: str) -> Membership:
    role = Role.objects.create(org=org, key=f"host-{org.slug}", label="Host")
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    return Membership.objects.create(
        org=org, user=user, role=role, display_name="Front Desk", email=email
    )


def _auth_client(
    org: Organization,
    restaurant: Restaurant,
    *,
    email: str,
) -> tuple[APIClient, Membership]:
    """Return an APIClient authenticated as a member of ``restaurant``."""
    membership = _make_membership(org, email=email)
    token = RefreshToken.for_user(membership.user)
    token["restaurant_id"] = str(restaurant.id)
    token["org_id"] = str(org.id)
    token["membership_id"] = str(membership.id)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client, membership


@pytest.fixture
def tenant_a():
    return _make_tenant("org-a", "AAA")


@pytest.fixture
def booking_ctx(tenant_a):
    org, restaurant = tenant_a
    client, membership = _auth_client(org, restaurant, email="host@relish.test")
    return client, restaurant, membership


# --- Reservations ------------------------------------------------------------


def test_create_reservation_is_scoped_to_caller_restaurant(booking_ctx):
    client, restaurant, _membership = booking_ctx

    resp = client.post(
        "/api/crm/reservations/",
        {
            "name": "Asha Rao",
            "phone": "+919812345678",
            "party_size": 4,
            "at": timezone.now().isoformat(),
            "notes": "Window seat",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["status"] == "booked"
    assert resp.data["name"] == "Asha Rao"
    assert resp.data["party_size"] == 4

    reservation = Reservation.all_objects.get(id=resp.data["id"])
    assert str(reservation.restaurant_id) == str(restaurant.id)

    list_resp = client.get("/api/crm/reservations/", format="json")
    assert list_resp.status_code == 200
    assert {row["name"] for row in list_resp.data["results"]} == {"Asha Rao"}


def test_create_reservation_rejects_zero_party_size(booking_ctx):
    client, _restaurant, _membership = booking_ctx

    resp = client.post(
        "/api/crm/reservations/",
        {
            "name": "Solo Diner",
            "phone": "+919800000000",
            "party_size": 0,
            "at": timezone.now().isoformat(),
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "party_size" in resp.data["detail"]


def test_reservation_seat_transition_sets_status_and_table(booking_ctx):
    client, restaurant, _membership = booking_ctx
    reservation = Reservation.objects.create(
        restaurant_id=restaurant.id,
        name="Dev Mehta",
        phone="+919811111111",
        party_size=2,
        at=timezone.now(),
    )
    assert reservation.status == "booked"

    table_id = uuid.uuid4()
    resp = client.post(
        f"/api/crm/reservations/{reservation.id}/seat/",
        {"table_id": str(table_id)},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "seated"
    assert resp.data["table_id"] == str(table_id)

    reservation.refresh_from_db()
    assert reservation.status == "seated"
    assert str(reservation.table_id) == str(table_id)


def test_reservation_cancel_transition(booking_ctx):
    client, restaurant, _membership = booking_ctx
    reservation = Reservation.objects.create(
        restaurant_id=restaurant.id,
        name="Cancel Me",
        phone="+919822222222",
        party_size=3,
        at=timezone.now(),
    )

    resp = client.post(
        f"/api/crm/reservations/{reservation.id}/cancel/", format="json"
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "cancelled"
    reservation.refresh_from_db()
    assert reservation.status == "cancelled"


def test_reservations_isolated_across_tenants(booking_ctx):
    client_a, restaurant_a, _membership = booking_ctx
    Reservation.objects.create(
        restaurant_id=restaurant_a.id,
        name="A Guest",
        phone="+919833333333",
        party_size=2,
        at=timezone.now(),
    )

    resp_a = client_a.get("/api/crm/reservations/", format="json")
    assert resp_a.status_code == 200
    assert {row["name"] for row in resp_a.data["results"]} == {"A Guest"}

    org_b, restaurant_b = _make_tenant("org-b", "BBB")
    client_b, _m = _auth_client(org_b, restaurant_b, email="b@relish.test")
    resp_b = client_b.get("/api/crm/reservations/", format="json")
    assert resp_b.status_code == 200
    assert resp_b.data["results"] == []


def test_destroy_reservation_soft_deletes(booking_ctx):
    client, restaurant, _membership = booking_ctx
    reservation = Reservation.objects.create(
        restaurant_id=restaurant.id,
        name="Bye Guest",
        phone="+919844444444",
        party_size=2,
        at=timezone.now(),
    )

    resp = client.delete(
        f"/api/crm/reservations/{reservation.id}/", format="json"
    )
    assert resp.status_code == 204

    archived = Reservation.all_objects.get(id=reservation.id)
    assert archived.deleted_at is not None

    list_resp = client.get("/api/crm/reservations/", format="json")
    ids = {uuid.UUID(row["id"]) for row in list_resp.data["results"]}
    assert reservation.id not in ids


# --- Waitlist ----------------------------------------------------------------


def test_create_waitlist_entry_and_transitions(booking_ctx):
    client, restaurant, _membership = booking_ctx

    create_resp = client.post(
        "/api/crm/waitlist/",
        {
            "name": "Priya Nair",
            "phone": "+919855555555",
            "party_size": 5,
            "quoted_mins": 20,
        },
        format="json",
    )
    assert create_resp.status_code == 201, create_resp.data
    assert create_resp.data["status"] == "waiting"
    assert create_resp.data["party_size"] == 5

    entry = WaitlistEntry.all_objects.get(id=create_resp.data["id"])
    assert str(entry.restaurant_id) == str(restaurant.id)

    entry_id = create_resp.data["id"]
    notify_resp = client.post(
        f"/api/crm/waitlist/{entry_id}/notify/", format="json"
    )
    assert notify_resp.status_code == 200, notify_resp.data
    assert notify_resp.data["status"] == "notified"

    seat_resp = client.post(
        f"/api/crm/waitlist/{entry_id}/seat/", format="json"
    )
    assert seat_resp.status_code == 200, seat_resp.data
    assert seat_resp.data["status"] == "seated"

    entry.refresh_from_db()
    assert entry.status == "seated"


def test_waitlist_leave_transition(booking_ctx):
    client, restaurant, _membership = booking_ctx
    entry = WaitlistEntry.objects.create(
        restaurant_id=restaurant.id, name="Impatient", party_size=2
    )

    resp = client.post(f"/api/crm/waitlist/{entry.id}/leave/", format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "left"
    entry.refresh_from_db()
    assert entry.status == "left"


# --- Feedback ----------------------------------------------------------------


def test_create_feedback_with_valid_rating(booking_ctx):
    client, restaurant, _membership = booking_ctx

    resp = client.post(
        "/api/crm/feedback/",
        {"rating": 5, "comment": "Outstanding service."},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["rating"] == 5

    feedback = Feedback.all_objects.get(id=resp.data["id"])
    assert str(feedback.restaurant_id) == str(restaurant.id)


def test_create_feedback_rejects_out_of_range_rating(booking_ctx):
    client, _restaurant, _membership = booking_ctx

    resp = client.post(
        "/api/crm/feedback/",
        {"rating": 6, "comment": "Off the scale."},
        format="json",
    )
    assert resp.status_code == 400
    assert "rating" in resp.data["detail"]


def test_feedback_list_is_newest_first(booking_ctx):
    client, restaurant, _membership = booking_ctx
    older = Feedback.objects.create(restaurant_id=restaurant.id, rating=3)
    newer = Feedback.objects.create(restaurant_id=restaurant.id, rating=5)

    resp = client.get("/api/crm/feedback/", format="json")
    assert resp.status_code == 200
    ids = [row["id"] for row in resp.data["results"]]
    assert ids == [str(newer.id), str(older.id)]
