"""WebSocket consumers for the Kitchen Display System (KDS) / waiter live sync.

Waiter tablets and kitchen displays connect to a per-restaurant group and
receive live order / table / service-request events that the rest of the
backend pushes via :mod:`realtime.broadcast` after DB writes (Phase 5).
"""
from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.exceptions import ValidationError


class KdsConsumer(AsyncJsonWebsocketConsumer):
    """Per-restaurant live feed for kitchen displays and waiter tablets.

    Clients are mostly passive listeners: once subscribed to the
    ``kds_<restaurant_id>`` group they receive ``order``/``table``/
    ``service_request`` frames forwarded from the channel layer. A lightweight
    ``ping`` action is supported so clients can keep the socket warm.
    """

    group_name: str

    async def connect(self) -> None:
        # Require an authenticated user — reject anonymous / missing users.
        user = self.scope.get("user")
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        restaurant_id = self.scope["url_route"]["kwargs"]["restaurant_id"]
        self.group_name = f"kds_{restaurant_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "restaurant_id": restaurant_id})

    async def disconnect(self, code: int) -> None:
        group_name = getattr(self, "group_name", None)
        if group_name is not None:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs: Any) -> None:
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})

    # ── Group event handlers (invoked by channel layer group_send) ──────────
    async def order_event(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "order_event", "payload": event.get("payload")})

    async def table_event(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "table_event", "payload": event.get("payload")})

    async def service_request_event(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {"type": "service_request_event", "payload": event.get("payload")}
        )


class SessionConsumer(AsyncJsonWebsocketConsumer):
    """Per-dining-session live feed for guest devices (and staff).

    Connects at ``ws/session/<session_id>/?token=<device_token>``. Guests
    authenticate with the opaque device token they were minted at join (the same
    credential the REST API uses); staff with an authenticated socket scope also
    pass. Once subscribed to ``session_<session_id>`` the client receives typed
    frames — ``order_placed`` / ``order_confirmed`` / ``leader_changed`` /
    ``check_updated`` / ``bill_requested`` / ``session_closed`` / ``presence`` —
    pushed by :func:`realtime.broadcast.broadcast_session_event` after DB writes.
    Polling remains the fallback when the socket is unavailable.
    """

    group_name: str

    async def connect(self) -> None:
        session_id = self.scope["url_route"]["kwargs"]["session_id"]
        token = self._token_from_scope()
        if not await self._authorized(session_id, token):
            await self.close(code=4401)
            return

        self.group_name = f"session_{session_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "session_id": session_id})
        # Let everyone at the table know presence changed.
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "session_event", "event": "presence", "payload": None},
        )

    def _token_from_scope(self) -> str:
        raw = self.scope.get("query_string", b"") or b""
        values = parse_qs(raw.decode()).get("token") or []
        return values[0] if values else ""

    @database_sync_to_async
    def _authorized(self, session_id: str, token: str) -> bool:
        """A valid device token for this session, or an authenticated staff scope."""
        from dining.models import DiningSession, GuestDevice

        try:
            if token:
                return GuestDevice.all_objects.filter(
                    session_id=session_id, device_token=token
                ).exists()
            user = self.scope.get("user")
            if user is not None and getattr(user, "is_authenticated", False):
                return DiningSession.all_objects.filter(pk=session_id).exists()
        except (ValueError, ValidationError):
            return False
        return False

    async def disconnect(self, code: int) -> None:
        group_name = getattr(self, "group_name", None)
        if group_name is not None:
            await self.channel_layer.group_send(
                group_name,
                {"type": "session_event", "event": "presence", "payload": None},
            )
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content: dict[str, Any], **kwargs: Any) -> None:
        if content.get("action") == "ping":
            await self.send_json({"type": "pong"})

    # ── Group event handler (invoked by channel layer group_send) ───────────
    async def session_event(self, event: dict[str, Any]) -> None:
        await self.send_json(
            {"type": event["event"], "payload": event.get("payload")}
        )
