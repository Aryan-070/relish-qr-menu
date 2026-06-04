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

from django.db import IntegrityError, transaction
from django.db.models import F
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
from common.versioning import StaleVersionError, parse_client_version
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


def _apply_versioned(pk: Any, client_version: int | None, fields: dict[str, Any]) -> bool:
    """Atomically apply ``fields`` to a table and bump its ``version``.

    This is a compare-and-swap: when ``client_version`` is supplied, the UPDATE
    is guarded by ``WHERE version = client_version`` so exactly one of N racing
    writers can win (the rest match zero rows → caller raises 409). A plain
    read-compare-then-``save()`` has a TOCTOU window where two writers both pass
    the in-Python check and both write — this closes it at the database, on both
    SQLite and Postgres (no row lock required). ``client_version=None`` keeps the
    legacy "no optimistic guard" behaviour (last write wins).

    Returns ``True`` when a row was updated.
    """
    qs = RestaurantTable.objects.filter(pk=pk)
    if client_version is not None:
        qs = qs.filter(version=client_version)
    return qs.update(version=F("version") + 1, updated_at=timezone.now(), **fields) > 0


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
        """Update with optimistic concurrency + a ``table_event`` broadcast.

        The version check and the write are a single atomic compare-and-swap
        (see ``_apply_versioned``) so concurrent updates can't both win.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)

        fields = dict(serializer.validated_data)
        fields.pop("version", None)
        if not _apply_versioned(instance.pk, parse_client_version(request.data), fields):
            raise StaleVersionError()

        instance.refresh_from_db()
        self._broadcast(instance)
        return Response(TableSerializer(instance).data)

    @extend_schema(request=SeatTableSerializer, responses=TableSerializer)
    @action(detail=True, methods=["post"])
    def seat(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Seat guests at a table: status='seated', guests, seated_at=now."""
        table = self.get_object()
        serializer = SeatTableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        fields: dict[str, Any] = {
            "status": "seated",
            "guests": data["guests"],
            "seated_at": timezone.now(),
        }
        if "waiter_membership_id" in data:
            fields["waiter_membership_id"] = data["waiter_membership_id"]
        if not _apply_versioned(table.pk, data.get("version"), fields):
            raise StaleVersionError()

        table.refresh_from_db()
        self._broadcast(table)
        return Response(TableSerializer(table).data)

    @extend_schema(request=None, responses=TableSerializer)
    @action(detail=True, methods=["post"])
    def clear(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Clear a table: status='available', guests=0, waiter+seated_at null."""
        table = self.get_object()
        fields = {
            "status": "available",
            "guests": 0,
            "waiter_membership": None,
            "seated_at": None,
        }
        if not _apply_versioned(table.pk, parse_client_version(request.data), fields):
            raise StaleVersionError()

        table.refresh_from_db()
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

        if not _apply_versioned(
            table.pk, parse_client_version(request.data), {"status": new_status}
        ):
            raise StaleVersionError()

        table.refresh_from_db()
        self._broadcast(table)
        return Response(TableSerializer(table).data)

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

    #: How many sequential codes to try before giving up under extreme
    #: contention. Reaching this would require this many simultaneous creates
    #: all racing the same code — effectively impossible in practice.
    _CODE_RETRY_ATTEMPTS = 25

    def create(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Create a request with a generated code + ``service_request_event``.

        The human-facing ``REQ-NNNNN`` code is seeded from a row count, which is
        inherently racy — two concurrent creates can compute the same number. A
        unique constraint on ``(restaurant_id, code)`` turns that collision into
        an ``IntegrityError`` instead of a silent duplicate, and we retry with
        the next sequential code until the insert lands, so racing requests
        always come away with distinct codes.
        """
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

        request_obj = self._create_with_unique_code(restaurant_id, table, data)

        self._broadcast(request_obj)
        return Response(
            ServiceRequestSerializer(request_obj).data,
            status=status.HTTP_201_CREATED,
        )

    def _create_with_unique_code(
        self, restaurant_id: Any, table: RestaurantTable, data: dict[str, Any]
    ) -> ServiceRequest:
        """Insert a ServiceRequest, retrying on the unique ``code`` collision.

        Each attempt runs in its own ``transaction.atomic()`` block so a failed
        insert rolls back cleanly (a raw ``IntegrityError`` would otherwise poison
        the surrounding transaction on Postgres).
        """
        seed = self._next_seq(restaurant_id)
        for offset in range(self._CODE_RETRY_ATTEMPTS):
            code = f"REQ-{seed + offset:05d}"
            try:
                with transaction.atomic():
                    return ServiceRequest.objects.create(
                        restaurant_id=restaurant_id,
                        table=table,
                        type=data["type"],
                        note=data.get("note", ""),
                        code=code,
                    )
            except IntegrityError:
                continue
        raise APIException(
            "Could not allocate a unique service-request code; please retry."
        )

    @staticmethod
    def _next_seq(restaurant_id: Any) -> int:
        """Best-effort next sequence number for a ``REQ-NNNNN`` code.

        Based on the all-time row count (soft-deleted included) so codes stay
        monotonic across deletes. This is only a *starting* guess — uniqueness is
        guaranteed by the DB constraint + retry in
        :meth:`_create_with_unique_code`, not by this count being exact.
        """
        count = ServiceRequest.all_objects.filter(
            restaurant_id=restaurant_id
        ).count()
        return count + 1

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
