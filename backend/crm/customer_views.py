"""DRF viewset for the customers + loyalty console surface.

Customers are **org-scoped** (a chain knows a guest across every outlet), so —
unlike the restaurant-scoped menu/ops viewsets — reads filter by
``org_id = get_current_org_id()`` and writes stamp that org id. Loyalty point
mutations delegate to :mod:`crm.loyalty_services`, where the append-only ledger
is the source of truth and the cached balance is kept in step.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from common.context import get_current_org_id
from common.permissions import IsTenantMember
from crm import loyalty_services
from crm.customer_serializers import (
    CustomerSerializer,
    EnrollCustomerSerializer,
    PointsSerializer,
)
from crm.loyalty_services import LoyaltyError
from crm.models import Customer


class LedgerEntrySerializer:
    """Inline shaping helper for ledger rows (kept dependency-free)."""

    @staticmethod
    def to_representation(entry: object) -> dict:
        return {
            "id": str(entry.id),
            "order_id": str(entry.order_id) if entry.order_id else None,
            "points_delta": entry.points_delta,
            "reason": entry.reason,
            "created_at": entry.created_at,
        }


class CustomerViewSet(viewsets.ModelViewSet):
    """Org-scoped customer CRUD + loyalty actions (earn / redeem / ledger)."""

    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        return Customer.objects.filter(
            org_id=get_current_org_id(), deleted_at__isnull=True
        )

    def create(self, request: Request, *args, **kwargs) -> Response:
        serializer = EnrollCustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer, created = loyalty_services.enroll_customer(
            org_id=get_current_org_id(),
            phone=serializer.validated_data["phone"],
            name=serializer.validated_data.get("name", ""),
            birth_date=serializer.validated_data.get("birth_date"),
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(CustomerSerializer(customer).data, status=code)

    def perform_destroy(self, instance: Customer) -> None:
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at", "updated_at"])

    @action(detail=True, methods=["post"])
    def earn(self, request: Request, *args, **kwargs) -> Response:
        customer = self.get_object()
        serializer = PointsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = loyalty_services.earn_points(
            customer,
            serializer.validated_data["points"],
            order_id=serializer.validated_data.get("order_id"),
        )
        return Response(CustomerSerializer(customer).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def redeem(self, request: Request, *args, **kwargs) -> Response:
        customer = self.get_object()
        serializer = PointsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            customer = loyalty_services.redeem_points(
                customer, serializer.validated_data["points"]
            )
        except LoyaltyError as exc:
            return Response(
                {"success": False, "error": "loyalty_error", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CustomerSerializer(customer).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def ledger(self, request: Request, *args, **kwargs) -> Response:
        customer = self.get_object()
        rows = [
            LedgerEntrySerializer.to_representation(entry)
            for entry in customer.ledger.all()
        ]
        return Response(rows, status=status.HTTP_200_OK)
