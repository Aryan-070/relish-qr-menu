"""Floor-slice API tests: tables + service requests.

Auth runs end to end through the JWT: tokens carry ``restaurant_id`` / ``org_id``
/ ``membership_id`` claims, and ``common.middleware.TenantMiddleware`` decodes the
``Authorization: Bearer`` header to bind the active tenant. We set credentials
with a real signed token (not ``force_authenticate``) so the middleware runs and
scoping/membership context are genuinely exercised.

Realtime broadcasts are asserted by patching the broadcast helpers as imported
into ``ops.floor_views`` (so we catch the call at the use site).
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import (
    Membership,
    Organization,
    Restaurant,
    Role,
)
from ops.models import RestaurantTable, ServiceRequest

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


# --- Fixtures / helpers ------------------------------------------------------


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _make_membership(org: Organization, *, email: str) -> Membership:
    role = Role.objects.create(org=org, key=f"waiter-{org.slug}", label="Waiter")
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    return Membership.objects.create(
        org=org, user=user, role=role, display_name="Floor Staff", email=email
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
def floor_client(tenant_a):
    org, restaurant = tenant_a
    client, _membership = _auth_client(org, restaurant, email="waiter@relish.test")
    return client


@pytest.fixture
def floor_ctx(tenant_a):
    org, restaurant = tenant_a
    client, membership = _auth_client(org, restaurant, email="waiter2@relish.test")
    return client, membership, restaurant


# --- Tables: create / list / isolation --------------------------------------


def test_member_can_create_and_list_table(floor_client, tenant_a):
    _org, restaurant = tenant_a

    create_resp = floor_client.post(
        "/api/ops/tables/",
        {"code": "T1", "label": "Table 1", "seats": 4, "zone": "Garden"},
        format="json",
    )
    assert create_resp.status_code == 201, create_resp.data
    assert create_resp.data["version"] == 1
    assert create_resp.data["status"] == "available"

    table = RestaurantTable.all_objects.get(id=create_resp.data["id"])
    assert str(table.restaurant_id) == str(restaurant.id)

    list_resp = floor_client.get("/api/ops/tables/", format="json")
    assert list_resp.status_code == 200
    assert {row["code"] for row in list_resp.data["results"]} == {"T1"}


def test_tables_isolated_across_tenants(floor_client, tenant_a):
    _org_a, restaurant_a = tenant_a
    RestaurantTable.objects.create(
        restaurant_id=restaurant_a.id, code="T1", label="A-1"
    )
    # A stray table for another restaurant must not leak in.
    other_restaurant_id = uuid.uuid4()
    RestaurantTable.objects.create(
        restaurant_id=other_restaurant_id, code="T1", label="Other-1"
    )

    resp_a = floor_client.get("/api/ops/tables/", format="json")
    assert resp_a.status_code == 200
    assert {row["label"] for row in resp_a.data["results"]} == {"A-1"}

    org_b, restaurant_b = _make_tenant("org-b", "BBB")
    client_b, _m = _auth_client(org_b, restaurant_b, email="b@relish.test")
    resp_b = client_b.get("/api/ops/tables/", format="json")
    assert resp_b.status_code == 200
    assert resp_b.data["results"] == []


# --- Seat / clear + broadcast ------------------------------------------------


def test_seat_sets_status_and_broadcasts(floor_ctx):
    floor_client, membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T2", label="Table 2"
    )

    with patch("ops.floor_views.broadcast_table_event") as mock_broadcast:
        resp = floor_client.post(
            f"/api/ops/tables/{table.id}/seat/",
            {"guests": 3, "waiter_membership_id": str(membership.id)},
            format="json",
        )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "seated"
    assert resp.data["guests"] == 3
    assert resp.data["version"] == 2
    assert resp.data["seated_at"] is not None

    table.refresh_from_db()
    assert table.status == "seated"
    assert str(table.waiter_membership_id) == str(membership.id)

    mock_broadcast.assert_called_once()
    args, _kwargs = mock_broadcast.call_args
    assert args[0] == str(restaurant.id)
    assert args[1]["status"] == "seated"
    assert args[1]["guests"] == 3


def test_clear_resets_table_and_broadcasts(floor_ctx):
    floor_client, membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id,
        code="T3",
        label="Table 3",
        status="seated",
        guests=2,
        waiter_membership=membership,
    )

    with patch("ops.floor_views.broadcast_table_event") as mock_broadcast:
        resp = floor_client.post(f"/api/ops/tables/{table.id}/clear/", format="json")

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "available"
    assert resp.data["guests"] == 0
    assert resp.data["waiter_membership"] is None

    table.refresh_from_db()
    assert table.status == "available"
    assert table.guests == 0
    assert table.waiter_membership_id is None
    assert table.seated_at is None
    mock_broadcast.assert_called_once()


def test_set_status_broadcasts_and_bumps_version(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T4", label="Table 4"
    )

    with patch("ops.floor_views.broadcast_table_event") as mock_broadcast:
        resp = floor_client.post(
            f"/api/ops/tables/{table.id}/set_status/",
            {"status": "needs-attention", "version": 1},
            format="json",
        )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "needs-attention"
    assert resp.data["version"] == 2
    mock_broadcast.assert_called_once()


def test_set_status_rejects_invalid_status(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T5", label="Table 5"
    )
    resp = floor_client.post(
        f"/api/ops/tables/{table.id}/set_status/",
        {"status": "nonsense"},
        format="json",
    )
    assert resp.status_code == 400
    assert "status" in resp.data["detail"]


# --- Optimistic concurrency --------------------------------------------------


def test_seat_with_stale_version_returns_409(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T6", label="Table 6"
    )
    assert table.version == 1

    resp = floor_client.post(
        f"/api/ops/tables/{table.id}/seat/",
        {"guests": 2, "version": 99},
        format="json",
    )
    assert resp.status_code == 409
    table.refresh_from_db()
    assert table.status == "available"
    assert table.version == 1


def test_update_with_stale_version_returns_409(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T7", label="Table 7"
    )

    resp = floor_client.patch(
        f"/api/ops/tables/{table.id}/",
        {"label": "Renamed", "version": 42},
        format="json",
    )
    assert resp.status_code == 409
    table.refresh_from_db()
    assert table.label == "Table 7"
    assert table.version == 1


def test_update_with_correct_version_bumps_and_broadcasts(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T8", label="Table 8"
    )

    with patch("ops.floor_views.broadcast_table_event") as mock_broadcast:
        resp = floor_client.patch(
            f"/api/ops/tables/{table.id}/",
            {"label": "Patio Table", "version": 1},
            format="json",
        )
    assert resp.status_code == 200, resp.data
    assert resp.data["version"] == 2
    table.refresh_from_db()
    assert table.label == "Patio Table"
    mock_broadcast.assert_called_once()


# --- Tables: soft delete -----------------------------------------------------


def test_destroy_soft_deletes_table(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T9", label="Table 9"
    )

    resp = floor_client.delete(f"/api/ops/tables/{table.id}/", format="json")
    assert resp.status_code == 204

    list_resp = floor_client.get("/api/ops/tables/", format="json")
    assert table.id not in {uuid.UUID(r["id"]) for r in list_resp.data["results"]}

    archived = RestaurantTable.all_objects.get(id=table.id)
    assert archived.deleted_at is not None


# --- Service requests: create / claim / resolve ------------------------------


def test_create_service_request_generates_code_and_broadcasts(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T10", label="Table 10"
    )

    with patch("ops.floor_views.broadcast_service_request_event") as mock_broadcast:
        resp = floor_client.post(
            "/api/ops/requests/",
            {"table_id": str(table.id), "type": "water", "note": "still water"},
            format="json",
        )

    assert resp.status_code == 201, resp.data
    assert resp.data["code"] == "REQ-00001"
    assert resp.data["status"] == "pending"
    assert resp.data["type"] == "water"

    mock_broadcast.assert_called_once()
    args, _kwargs = mock_broadcast.call_args
    assert args[0] == str(restaurant.id)
    assert args[1]["code"] == "REQ-00001"

    # A second request increments the per-restaurant counter.
    resp2 = floor_client.post(
        "/api/ops/requests/",
        {"table_id": str(table.id), "type": "bill"},
        format="json",
    )
    assert resp2.status_code == 201
    assert resp2.data["code"] == "REQ-00002"


def test_service_request_code_is_unique_per_restaurant(floor_ctx):
    """The DB constraint backs the retry: a duplicate code is rejected."""
    _floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T12", label="Table 12"
    )
    ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="waiter", code="REQ-00001"
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ServiceRequest.objects.create(
            restaurant_id=restaurant.id, table=table, type="bill", code="REQ-00001"
        )


def test_create_service_request_retries_past_code_collision(floor_ctx):
    """A seeded code that already exists is skipped, not 500'd.

    Seeding one existing row makes ``_next_seq`` compute ``REQ-00002``; that code
    is already taken, so the create must retry forward to ``REQ-00003`` rather
    than raising the unique-constraint IntegrityError.
    """
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T13", label="Table 13"
    )
    # One existing row → seq seed becomes 2 → first attempted code is REQ-00002,
    # which we pre-occupy to force the collision/retry path.
    ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="waiter", code="REQ-00002"
    )

    with patch("ops.floor_views.broadcast_service_request_event"):
        resp = floor_client.post(
            "/api/ops/requests/",
            {"table_id": str(table.id), "type": "bill"},
            format="json",
        )

    assert resp.status_code == 201, resp.data
    assert resp.data["code"] == "REQ-00003"


def test_create_service_request_rejects_foreign_table(floor_ctx):
    floor_client, _membership, _restaurant = floor_ctx
    foreign_restaurant_id = uuid.uuid4()
    foreign_table = RestaurantTable.objects.create(
        restaurant_id=foreign_restaurant_id, code="X1", label="Foreign"
    )
    resp = floor_client.post(
        "/api/ops/requests/",
        {"table_id": str(foreign_table.id), "type": "waiter"},
        format="json",
    )
    assert resp.status_code == 400
    assert "table_id" in resp.data["detail"]


def test_claim_service_request_sets_membership_and_broadcasts(floor_ctx):
    floor_client, membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T11", label="Table 11"
    )
    request_obj = ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="waiter", code="REQ-00001"
    )

    with patch("ops.floor_views.broadcast_service_request_event") as mock_broadcast:
        resp = floor_client.post(
            f"/api/ops/requests/{request_obj.id}/claim/", format="json"
        )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "claimed"
    request_obj.refresh_from_db()
    assert request_obj.status == "claimed"
    assert str(request_obj.claimed_by_membership_id) == str(membership.id)
    mock_broadcast.assert_called_once()


def test_resolve_service_request_broadcasts(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T12", label="Table 12"
    )
    request_obj = ServiceRequest.objects.create(
        restaurant_id=restaurant.id,
        table=table,
        type="assistance",
        status="claimed",
        code="REQ-00001",
    )

    with patch("ops.floor_views.broadcast_service_request_event") as mock_broadcast:
        resp = floor_client.post(
            f"/api/ops/requests/{request_obj.id}/resolve/", format="json"
        )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "resolved"
    request_obj.refresh_from_db()
    assert request_obj.status == "resolved"
    mock_broadcast.assert_called_once()


def test_request_list_defaults_to_active_queue(floor_ctx):
    floor_client, _membership, restaurant = floor_ctx
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T13", label="Table 13"
    )
    ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="water",
        status="pending", code="REQ-00001",
    )
    ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="bill",
        status="claimed", code="REQ-00002",
    )
    ServiceRequest.objects.create(
        restaurant_id=restaurant.id, table=table, type="cleanup",
        status="resolved", code="REQ-00003",
    )

    # Default: live queue only (pending + claimed).
    resp = floor_client.get("/api/ops/requests/", format="json")
    assert resp.status_code == 200
    codes = {row["code"] for row in resp.data["results"]}
    assert codes == {"REQ-00001", "REQ-00002"}

    # ?status= narrows to a single status.
    resolved_resp = floor_client.get(
        "/api/ops/requests/?status=resolved", format="json"
    )
    assert {row["code"] for row in resolved_resp.data["results"]} == {"REQ-00003"}
