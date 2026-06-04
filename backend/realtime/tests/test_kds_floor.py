"""End-to-end KDS tests for the floor slice broadcasts.

Drive the :class:`realtime.consumers.KdsConsumer` through a
``WebsocketCommunicator`` (authenticated user in scope), then fire the floor
broadcast helpers and assert the connected client receives the forwarded frame.
Runs against the in-memory channel layer (no Redis); ``conftest.py`` enables
``asyncio_mode = auto`` for this package.
"""
from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model

from realtime.broadcast import (
    broadcast_service_request_event,
    broadcast_table_event,
)
from realtime.consumers import KdsConsumer

pytestmark = pytest.mark.asyncio

RESTAURANT_ID = "99"


@database_sync_to_async
def _create_user():
    """Create and return a persisted, authenticated user."""
    User = get_user_model()
    return User.objects.create_user(
        email="floor-kds@example.com",
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
async def test_service_request_broadcast_reaches_client() -> None:
    user = await _create_user()
    communicator = _make_communicator(user)

    connected, _ = await communicator.connect()
    assert connected is True

    # Drain the initial "connected" frame.
    await communicator.receive_json_from()

    payload = {
        "id": "req-1",
        "code": "REQ-00001",
        "table_id": "tbl-1",
        "type": "water",
        "status": "pending",
    }
    await sync_to_async(broadcast_service_request_event)(RESTAURANT_ID, payload)

    frame = await communicator.receive_json_from()
    assert frame == {"type": "service_request_event", "payload": payload}

    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_table_broadcast_reaches_client() -> None:
    user = await _create_user()
    communicator = _make_communicator(user)

    connected, _ = await communicator.connect()
    assert connected is True

    await communicator.receive_json_from()

    payload = {
        "id": "tbl-1",
        "code": "T1",
        "status": "seated",
        "guests": 3,
        "version": 2,
    }
    await sync_to_async(broadcast_table_event)(RESTAURANT_ID, payload)

    frame = await communicator.receive_json_from()
    assert frame == {"type": "table_event", "payload": payload}

    await communicator.disconnect()
