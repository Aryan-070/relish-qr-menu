"""DRF viewsets for the floor slice: tables + service requests.

These power the live waiter / KDS surface. Both viewsets are tenant-scoped end
to end:

* **Reads** go through ``Model.objects`` (the ``TenantManager``), which
  auto-filters to the active restaurant and excludes soft-deleted rows;
  ``get_queryset`` additionally pins ``restaurant_id`` belt-and-suspenders.
* **Writes** stamp ``restaurant_id = get_current_restaurant_id()`` on create.
* **Deletes** are soft (``instance.soft_delete()``).

Authorization: floor ops are not in the gated permission set, so every endpoint
only requires an authenticated tenant member (``IsAuthenticated`` +
``IsTenantMember``).

Realtime: every table mutation (seat / clear / set-status / update) fans a
``table_event`` out to the restaurant's KDS group, and every service-request
mutation (create / claim / resolve) fans a ``service_request_event`` — so
waiter tablets and kitchen displays stay live without polling.

``TableViewSet`` and the ``set_status``/``seat``/``clear`` actions carry
optimistic concurrency: a request whose ``version`` no longer matches the stored
row is rejected with HTTP 409; a successful mutation bumps ``version`` by one.
"""
from __future__ import annotations

from typing import Any

from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.context import (
    get_current_membership_id,
    get_current_restaurant_id,
)
from common.permissions import IsTenantMember
from ops.floor_serializers import (
    CreateServiceRequestSerializer,
    SeatTableSerializer,
    ServiceRequestSerializer,
    TableSerializer,
)
from ops.models import (
    TABLE_STATUS_CHOICES,
    RestaurantTable,
    ServiceRequest,
)
from realtime.broadcast import (
    broadcast_service_request_event,
    broadcast_table_event,
)

#: Service-request statuses surfaced by default on the list endpoint (the live
#: queue) — resolved requests are excluded unless explicitly requested.
_ACTIVE_REQUEST_STATUSES = ("pending", "claimed")


class StaleVersionError(APIException):
    """Raised when a table mutation carries a stale optimistic-concurrency token."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This table was modified by someone else. Reload and try again."
    )
    default_code = "stale_version"


def _client_version(data: Any) -> int | None:
    """Coerce a supplied ``version`` to ``int``; ``None`` when absent/blank."""
    raw = data.get("version") if hasattr(data, "get") else None
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _table_payload(table: RestaurantTable) -> dict[str, Any]:
    """A small serialized dict broadcast to the KDS group after a table change."""
    return {
        "id": str(table.id),
        "code": table.code,
        "label": table.label,
        "status": table.status,
        "guests": table.guests,
        "zone": table.zone,
        "waiter_membership_id": (
            str(table.waiter_membership_id)
            if table.waiter_membership_id
            else None
        ),
        "seated_at": table.seated_at.isoformat() if table.seated_at else None,
        "version": table.version,
    }


def _request_payload(request_obj: ServiceRequest) -> dict[str, Any]:
    """A small serialized dict broadcast to the KDS group after a request change."""
    return {
        "id": str(request_obj.id),
        "code": request_obj.code,
        "table_id": str(request_obj.table_id),
        "type": request_obj.type,
        "status": request_obj.status,
        "claimed_by_membership_id": (
            str(request_obj.claimed_by_membership_id)
            if request_obj.claimed_by_membership_id
            else None
        ),
        "note": request_obj.note,
    }


class TableViewSet(viewsets.ModelViewSet):
    """Tenant-scoped CRUD for floor tables, plus seat/clear/set-status actions.

    Standard create/list/retrieve/update/destroy is inherited; the ``seat``,
    ``clear`` and ``set_status`` actions encode the floor state machine. Every
    mutation broadcasts a ``table_event`` and (where a ``version`` is supplied)
    enforces optimistic concurrency.
    """

    serializer_class = TableSerializer
    queryset = RestaurantTable.objects.all()
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        """Active-tenant tables only (manager excludes soft-deleted rows)."""
        return RestaurantTable.objects.filter(
            restaurant_id=get_current_restaurant_id()
        )

    def perform_create(self, serializer) -> None:
        """Stamp the active restaurant onto the new table."""
        serializer.save(restaurant_id=get_current_restaurant_id())

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()

    def update(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Update with optimistic concurrency + a ``table_event`` broadcast."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        client_version = _client_version(request.data)
        if client_version is not None and client_version != instance.version:
            raise StaleVersionError()

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(version=instance.version + 1)

        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache = {}

        self._broadcast(instance)
        return Response(serializer.data)

    @extend_schema(request=SeatTableSerializer, responses=TableSerializer)
    @action(detail=True, methods=["post"])
    def seat(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Seat guests at a table: status='seated', guests, seated_at=now."""
        table = self.get_object()
        serializer = SeatTableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        self._check_version(table, data.get("version"))

        table.status = "seated"
        table.guests = data["guests"]
        table.seated_at = timezone.now()
        if "waiter_membership_id" in data:
            table.waiter_membership_id = data["waiter_membership_id"]
        table.version += 1
        table.save()

        self._broadcast(table)
        return Response(TableSerializer(table).data)

    @extend_schema(request=None, responses=TableSerializer)
    @action(detail=True, methods=["post"])
    def clear(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Clear a table: status='available', guests=0, waiter+seated_at null."""
        table = self.get_object()
        self._check_version(table, _client_version(request.data))

        table.status = "available"
        table.guests = 0
        table.waiter_membership = None
        table.seated_at = None
        table.version += 1
        table.save()

        self._broadcast(table)
        return Response(TableSerializer(table).data)

    @extend_schema(
        request=inline_serializer(
            "TableSetStatusRequest",
            {
                "status": serializers.CharField(),
                "version": serializers.IntegerField(required=False),
            },
        ),
        responses=TableSerializer,
    )
    @action(detail=True, methods=["post"], url_path="set_status")
    def set_status(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Set an arbitrary table status from the floor state machine."""
        table = self.get_object()
        new_status = (
            request.data.get("status") if hasattr(request.data, "get") else None
        )
        valid = {choice for choice, _label in TABLE_STATUS_CHOICES}
        if new_status not in valid:
            raise ValidationError({"status": "Invalid table status."})

        self._check_version(table, _client_version(request.data))

        table.status = new_status
        table.version += 1
        table.save()

        self._broadcast(table)
        return Response(TableSerializer(table).data)

    @staticmethod
    def _check_version(table: RestaurantTable, client_version: Any) -> None:
        """Reject the mutation when a supplied ``version`` is stale."""
        if client_version is not None and client_version != table.version:
            raise StaleVersionError()

    @staticmethod
    def _broadcast(table: RestaurantTable) -> None:
        """Fan a ``table_event`` out to the table's restaurant KDS group."""
        broadcast_table_event(str(table.restaurant_id), _table_payload(table))


class ServiceRequestViewSet(viewsets.ModelViewSet):
    """Tenant-scoped service requests with claim/resolve actions.

    The list defaults to the live queue (pending + claimed); pass ``?status=``
    to filter to a single status. Create generates a per-restaurant code
    (``REQ-00001`` …) and broadcasts a ``service_request_event``; ``claim`` and
    ``resolve`` advance the lifecycle and broadcast too.
    """

    serializer_class = ServiceRequestSerializer
    queryset = ServiceRequest.objects.all()
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        """Active queue by default; ``?status=`` narrows to one status."""
        qs = ServiceRequest.objects.filter(
            restaurant_id=get_current_restaurant_id()
        )
        requested_status = self.request.query_params.get("status")
        if requested_status:
            return qs.filter(status=requested_status)
        return qs.filter(status__in=_ACTIVE_REQUEST_STATUSES)

    def perform_destroy(self, instance) -> None:
        """Soft-delete instead of removing the row."""
        instance.soft_delete()

    def create(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Create a request with a generated code + ``service_request_event``."""
        serializer = CreateServiceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        restaurant_id = get_current_restaurant_id()

        table = (
            RestaurantTable.objects.filter(
                restaurant_id=restaurant_id, id=data["table_id"]
            )
            .first()
        )
        if table is None:
            raise ValidationError({"table_id": "No such table for this restaurant."})

        request_obj = ServiceRequest.objects.create(
            restaurant_id=restaurant_id,
            table=table,
            type=data["type"],
            note=data.get("note", ""),
            code=self._next_code(restaurant_id),
        )

        self._broadcast(request_obj)
        return Response(
            ServiceRequestSerializer(request_obj).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=None, responses=ServiceRequestSerializer)
    @action(detail=True, methods=["post"])
    def claim(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Claim a pending request for the calling membership."""
        request_obj = self.get_object()
        request_obj.status = "claimed"
        request_obj.claimed_by_membership_id = get_current_membership_id()
        request_obj.save(update_fields=["status", "claimed_by_membership", "updated_at"])

        self._broadcast(request_obj)
        return Response(ServiceRequestSerializer(request_obj).data)

    @extend_schema(request=None, responses=ServiceRequestSerializer)
    @action(detail=True, methods=["post"])
    def resolve(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Mark a request resolved (served / handled)."""
        request_obj = self.get_object()
        request_obj.status = "resolved"
        request_obj.save(update_fields=["status", "updated_at"])

        self._broadcast(request_obj)
        return Response(ServiceRequestSerializer(request_obj).data)

    @staticmethod
    def _next_code(restaurant_id: Any) -> str:
        """Return the next ``REQ-00001`` style code for the restaurant."""
        count = ServiceRequest.all_objects.filter(
            restaurant_id=restaurant_id
        ).count()
        return f"REQ-{count + 1:05d}"

    @staticmethod
    def _broadcast(request_obj: ServiceRequest) -> None:
        """Fan a ``service_request_event`` to the request's restaurant group."""
        broadcast_service_request_event(
            str(request_obj.restaurant_id), _request_payload(request_obj)
        )
