"""Tests for the dining SessionConsumer (guest live feed).

Driven through ``WebsocketCommunicator`` against the in-memory channel layer.
A guest authenticates with the opaque device token (query string); an invalid
token is rejected; a broadcast reaches a connected client.
"""
from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from accounts.models import Organization, Restaurant
from dining.models import DiningSession, GuestDevice
from ops.models import RestaurantTable
from realtime.broadcast import broadcast_session_event
from realtime.consumers import SessionConsumer

pytestmark = pytest.mark.asyncio


@database_sync_to_async
def _make_session_and_device() -> tuple[str, str]:
    """Create a live session + one device; return (session_id, device_token)."""
    org = Organization.objects.create(name="WS Org", slug="ws-org")
    restaurant = Restaurant.objects.create(org=org, name="WS Outlet", code="WS1")
    table = RestaurantTable.objects.create(
        restaurant_id=restaurant.id, code="T1", label="T1"
    )
    session = DiningSession.objects.create(
        restaurant_id=restaurant.id, table=table
    )
    device = GuestDevice.objects.create(restaurant_id=restaurant.id, session=session)
    return str(session.id), str(device.device_token)


def _communicator(session_id: str, token: str) -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        SessionConsumer.as_asgi(), f"/ws/session/{session_id}/?token={token}"
    )
    communicator.scope["url_route"] = {"kwargs": {"session_id": session_id}}
    communicator.scope["query_string"] = f"token={token}".encode()
    return communicator


@pytest.mark.django_db(transaction=True)
async def test_valid_device_token_connects_and_receives_events() -> None:
    session_id, token = await _make_session_and_device()
    communicator = _communicator(session_id, token)

    connected, _ = await communicator.connect()
    assert connected is True

    # Drain the direct "connected" frame and the presence frame our own connect
    # broadcasts to the group.
    first = await communicator.receive_json_from()
    assert first == {"type": "connected", "session_id": session_id}
    presence = await communicator.receive_json_from()
    assert presence["type"] == "presence"

    # A subsequent broadcast reaches us as a typed frame.
    await sync_to_async(broadcast_session_event)(
        session_id, "check_updated", {"total_minor": 21000}
    )
    frame = await communicator.receive_json_from()
    assert frame == {"type": "check_updated", "payload": {"total_minor": 21000}}

    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_invalid_device_token_is_rejected() -> None:
    session_id, _token = await _make_session_and_device()
    communicator = _communicator(session_id, "00000000-0000-0000-0000-000000000000")

    connected, code = await communicator.connect()
    assert connected is False
    assert code == 4401

    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_missing_token_is_rejected() -> None:
    session_id, _token = await _make_session_and_device()
    communicator = WebsocketCommunicator(
        SessionConsumer.as_asgi(), f"/ws/session/{session_id}/"
    )
    communicator.scope["url_route"] = {"kwargs": {"session_id": session_id}}
    communicator.scope["query_string"] = b""

    connected, code = await communicator.connect()
    assert connected is False
    assert code == 4401

    await communicator.disconnect()
