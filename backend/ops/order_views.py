"""API views for the orders slice.

Placing / listing / status changes require an authenticated tenant member.
Governance actions are individually permission-gated: ``void`` needs the
``void`` permission, ``comp`` needs ``comp``, ``discount`` needs ``discount``.
Every create and every status/governance mutation fans a small event out to the
restaurant's KDS group via :func:`realtime.broadcast.broadcast_order_event`.

All order pricing is computed in :mod:`ops.services`; views never read money
from the request body.
"""
from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from common.context import get_current_membership_id, get_current_restaurant_id
from common.permissions import HasPermission, IsTenantMember
from ops.models import Order
from ops.order_serializers import OrderSerializer, PlaceOrderSerializer
from ops.services import (
    OrderError,
    apply_discount,
    comp_order,
    place_order,
    void_order,
)
from realtime.broadcast import broadcast_order_event

ORDER_STATUSES = {"new", "preparing", "ready", "served"}


class StaleVersionError(APIException):
    """Raised when an optimistic-concurrency ``version`` no longer matches."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This order was modified by someone else. Reload and retry."
    default_code = "stale_version"


def _order_event_payload(order: Order) -> dict[str, Any]:
    """Return the compact realtime payload broadcast on order changes."""
    return {
        "id": str(order.id),
        "code": order.code,
        "status": order.status,
        "total_minor": order.total_minor,
        "voided": order.voided,
        "comp": order.comp,
    }


def _get_order_or_404(pk: Any) -> Order:
    """Fetch a tenant-scoped order with its lines prefetched, or 404."""
    order = (
        Order.objects.filter(pk=pk)
        .prefetch_related("lines__modifiers")
        .first()
    )
    if order is None:
        raise NotFound("Order not found.")
    return order


class OrderListCreateView(APIView):
    """List orders (newest-first, tenant-scoped) or place a new one."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request: Request) -> Response:
        orders = Order.objects.prefetch_related("lines__modifiers").order_by(
            "-placed_at"
        )
        page_size = 50
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        start = (page - 1) * page_size
        window = list(orders[start : start + page_size])
        serializer = OrderSerializer(window, many=True)
        return Response(
            {
                "results": serializer.data,
                "count": orders.count(),
                "page": page,
            }
        )

    def post(self, request: Request) -> Response:
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        restaurant_id = get_current_restaurant_id()
        try:
            order = place_order(
                restaurant_id=restaurant_id,
                table_id=data.get("table_id"),
                waiter_membership_id=data.get("waiter_membership_id"),
                source=data.get("source", "staff"),
                lines=data["lines"],
            )
        except OrderError as exc:
            raise ValidationError(str(exc)) from exc

        broadcast_order_event(restaurant_id, _order_event_payload(order))
        return Response(
            OrderSerializer(order).data, status=status.HTTP_201_CREATED
        )


class OrderStatusView(APIView):
    """PATCH an order's status with optimistic concurrency on ``version``."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def patch(self, request: Request, pk: Any) -> Response:
        order = _get_order_or_404(pk)

        new_status = request.data.get("status")
        if new_status not in ORDER_STATUSES:
            raise ValidationError({"status": "Invalid order status."})

        client_version = request.data.get("version")
        if client_version is not None and int(client_version) != order.version:
            raise StaleVersionError()

        order.status = new_status
        order.version += 1
        order.save(update_fields=["status", "version", "updated_at"])

        broadcast_order_event(
            get_current_restaurant_id(), _order_event_payload(order)
        )
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)


class OrderVoidView(APIView):
    """Void an order (permission-gated) and audit it."""

    permission_classes = [IsAuthenticated, IsTenantMember, HasPermission("void")]

    def post(self, request: Request, pk: Any) -> Response:
        order = _get_order_or_404(pk)
        reason = str(request.data.get("reason", ""))
        void_order(order, get_current_membership_id(), reason)

        broadcast_order_event(
            get_current_restaurant_id(), _order_event_payload(order)
        )
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)


class OrderCompView(APIView):
    """Comp an order (permission-gated) and audit it."""

    permission_classes = [IsAuthenticated, IsTenantMember, HasPermission("comp")]

    def post(self, request: Request, pk: Any) -> Response:
        order = _get_order_or_404(pk)
        reason = str(request.data.get("reason", ""))
        comp_order(order, get_current_membership_id(), reason)

        broadcast_order_event(
            get_current_restaurant_id(), _order_event_payload(order)
        )
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)


class OrderDiscountView(APIView):
    """Apply a percentage discount (permission-gated) and audit it."""

    permission_classes = [IsAuthenticated, IsTenantMember, HasPermission("discount")]

    def post(self, request: Request, pk: Any) -> Response:
        order = _get_order_or_404(pk)
        raw_pct = request.data.get("discount_pct")
        if raw_pct is None:
            raise ValidationError({"discount_pct": "This field is required."})
        try:
            pct = int(raw_pct)
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                {"discount_pct": "Must be an integer percentage."}
            ) from exc

        reason = str(request.data.get("reason", ""))
        try:
            apply_discount(order, pct, get_current_membership_id(), reason)
        except OrderError as exc:
            raise ValidationError({"discount_pct": str(exc)}) from exc

        broadcast_order_event(
            get_current_restaurant_id(), _order_event_payload(order)
        )
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)
