"""WebSocket consumers for the Kitchen Display System (KDS) / waiter live sync.

Waiter tablets and kitchen displays connect to a per-restaurant group and
receive live order / table / service-request events that the rest of the
backend pushes via :mod:`realtime.broadcast` after DB writes (Phase 5).
"""
from __future__ import annotations

from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer


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
