"""Sync broadcast helpers used by the rest of the backend after DB writes.

Phase 5 call sites (order/table/service-request mutations) invoke these from
ordinary synchronous Django code. Each helper fans the payload out to the
``kds_<restaurant_id>`` channel group, which :class:`realtime.consumers.KdsConsumer`
instances are subscribed to.
"""
from __future__ import annotations

from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _broadcast(restaurant_id: Any, event_type: str, payload: Any) -> None:
    """Send ``payload`` to the restaurant's KDS group under ``event_type``.

    Silently no-ops when no channel layer is configured (e.g. CHANNEL_LAYERS
    unset) so callers in request/response paths never crash on broadcast.
    """
    layer = get_channel_layer()
    if layer is None:
        return
    group_name = f"kds_{restaurant_id}"
    async_to_sync(layer.group_send)(
        group_name, {"type": event_type, "payload": payload}
    )


def broadcast_order_event(restaurant_id: Any, payload: Any) -> None:
    """Push an order event (new/updated/bumped ticket) to the KDS group."""
    _broadcast(restaurant_id, "order_event", payload)


def broadcast_table_event(restaurant_id: Any, payload: Any) -> None:
    """Push a table event (seated/cleared/merged) to the KDS group."""
    _broadcast(restaurant_id, "table_event", payload)


def broadcast_service_request_event(restaurant_id: Any, payload: Any) -> None:
    """Push a service-request event (call waiter / bill request) to the KDS group."""
    _broadcast(restaurant_id, "service_request_event", payload)
