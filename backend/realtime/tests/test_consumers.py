"""Tests for the KDS WebSocket consumer and broadcast helpers.

Run against the in-memory channel layer (no Redis). Each test drives the
consumer through ``channels.testing.WebsocketCommunicator`` with a hand-crafted
``url_route`` kwarg and an authenticated (or anonymous) user in the scope.
"""
from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from realtime.broadcast import broadcast_order_event
from realtime.consumers import KdsConsumer

pytestmark = pytest.mark.asyncio

RESTAURANT_ID = "42"


@database_sync_to_async
def _create_user():
    """Create and return a persisted, authenticated user."""
    User = get_user_model()
    return User.objects.create_user(
        email="kds-tester@example.com",
        password="pw-strong-123",  # noqa: S106 - test fixture only
    )


def _make_communicator(user) -> WebsocketCommunicator:
    """Build a communicator targeting KdsConsumer with a url_route + user scope."""
    communicator = WebsocketCommunicator(
        KdsConsumer.as_asgi(), f"/ws/kds/{RESTAURANT_ID}/"
    )
    communicator.scope["url_route"] = {"kwargs": {"restaurant_id": RESTAURANT_ID}}
    communicator.scope["user"] = user
    return communicator


@pytest.mark.django_db(transaction=True)
async def test_authenticated_connection_receives_connected_frame() -> None:
    user = await _create_user()
    communicator = _make_communicator(user)

    connected, _ = await communicator.connect()
    assert connected is True

    frame = await communicator.receive_json_from()
    assert frame == {"type": "connected", "restaurant_id": RESTAURANT_ID}

    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_broadcast_order_event_reaches_client() -> None:
    user = await _create_user()
    communicator = _make_communicator(user)

    connected, _ = await communicator.connect()
    assert connected is True

    # Drain the initial "connected" frame.
    await communicator.receive_json_from()

    payload = {"order_id": 7, "status": "fired", "table": "T3"}
    # broadcast_order_event is synchronous — run it off the event loop.
    await sync_to_async(broadcast_order_event)(RESTAURANT_ID, payload)

    frame = await communicator.receive_json_from()
    assert frame == {"type": "order_event", "payload": payload}

    await communicator.disconnect()


async def test_anonymous_connection_is_rejected() -> None:
    communicator = _make_communicator(AnonymousUser())

    connected, code = await communicator.connect()
    assert connected is False
    assert code == 4401

    await communicator.disconnect()
