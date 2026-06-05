"""API views for the dining-session slice.

``join`` and ``orders`` are pure guest endpoints (no JWT — identity is the
``X-Device-Token`` header). ``promote`` / ``confirm`` / ``close`` are staff
actions (JWT + tenant member). ``contact`` and ``request-bill`` accept either a
joined device or staff. All ordering authority is enforced by the permission
classes + services, never by trusting the client.
"""
from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import Restaurant
from billing.services import RazorpayConfigError, RazorpayError
from common.context import get_current_membership_id
from common.permissions import IsTenantMember
from ops.floor_serializers import ServiceRequestSerializer
from ops.order_serializers import OrderSerializer, PlaceOrderSerializer
from ops.services import OrderError
from realtime.broadcast import (
    broadcast_order_event,
    broadcast_service_request_event,
    broadcast_session_event,
)

from .constants import LIVE_SESSION_STATUSES
from .models import DiningSession, GuestDevice
from .payments import (
    CheckPaymentError,
    create_check_payment,
    mark_check_disputed,
    settle_check_cash,
)
from .permissions import CanSubmitOrder, IsSessionParticipant
from .serializers import (
    ConfirmOrdersSerializer,
    ContactSerializer,
    DiningSessionSerializer,
    DisputeSerializer,
    JoinResultSerializer,
    JoinSessionSerializer,
    PayResultSerializer,
    PromoteSerializer,
    ServiceRequestCreateSerializer,
)
from .services import (
    SessionError,
    attach_customer,
    close_session,
    confirm_orders,
    create_service_request,
    find_device,
    join_session,
    promote_device,
    request_bill,
    submit_order,
    touch_device,
)

logger = logging.getLogger(__name__)


class SessionStaleVersionError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This session was modified by someone else. Reload and retry."
    default_code = "stale_version"


class PaymentUnavailableError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Online payment is not available right now."
    default_code = "payment_unavailable"


def _order_event_payload(order: Any) -> dict[str, Any]:
    return {
        "id": str(order.id),
        "code": order.code,
        "status": order.status,
        "total_minor": order.total_minor,
        "confirmation": order.confirmation,
        "session_id": str(order.session_id) if order.session_id else None,
    }


def _get_session_or_404(pk: Any) -> DiningSession:
    session = DiningSession.all_objects.filter(pk=pk).first()
    if session is None:
        raise NotFound("Session not found.")
    return session


def _org_id_for(session: DiningSession) -> Any:
    restaurant = Restaurant.objects.filter(pk=session.restaurant_id).first()
    return restaurant.org_id if restaurant is not None else None


def _session_response(session: DiningSession, device: Any = None) -> Response:
    """Serialize a session with the requesting device's ``me`` / ``can_order``."""
    return Response(
        DiningSessionSerializer(session, context={"device": device}).data
    )


class JoinView(APIView):
    """POST a (restaurant_id, table_id) to join/open a table session."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "dining_join"

    @extend_schema(
        request=JoinSessionSerializer,
        responses={201: JoinResultSerializer},
        tags=["dining"],
        auth=[],
    )
    def post(self, request: Request) -> Response:
        s = JoinSessionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        try:
            session, device, _created = join_session(
                restaurant_id=data["restaurant_id"],
                table_id=data["table_id"],
                display_name=data.get("display_name", ""),
            )
        except SessionError as exc:
            raise ValidationError(str(exc)) from exc

        result = {
            "session_id": session.id,
            "device_token": device.device_token,
            "role": device.role,
            "epoch": session.epoch,
            "order_confirmation_mode": session.order_confirmation_mode,
            "status": session.status,
        }
        return Response(
            JoinResultSerializer(result).data, status=status.HTTP_201_CREATED
        )


class SessionListView(APIView):
    """Staff: list the tenant's live dining sessions (the floor cockpit feed)."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(responses={200: DiningSessionSerializer(many=True)}, tags=["dining"])
    def get(self, request: Request) -> Response:
        # TenantManager scopes to the JWT's restaurant_id automatically.
        sessions = (
            DiningSession.objects.filter(status__in=LIVE_SESSION_STATUSES)
            .select_related("table", "tab")
            .prefetch_related("devices", "orders__lines__modifiers")
            .order_by("table__code")
        )
        return Response({"results": DiningSessionSerializer(sessions, many=True).data})


class SessionDetailView(APIView):
    """GET the live session snapshot (the polling endpoint)."""

    permission_classes = [IsSessionParticipant]

    @extend_schema(responses={200: DiningSessionSerializer}, tags=["dining"])
    def get(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        device = getattr(request, "dining_device", None)
        if device is not None:
            touch_device(device)
        session = (
            DiningSession.all_objects.filter(pk=session.pk)
            .prefetch_related("devices", "orders__lines__modifiers")
            .first()
        )
        return _session_response(session, device)


class SessionOrderView(APIView):
    """POST an order as a joined device, honoring the session's policy."""

    authentication_classes: list = []
    permission_classes = [CanSubmitOrder]

    @extend_schema(
        request=PlaceOrderSerializer,
        responses={201: OrderSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        device = getattr(request, "dining_device", None)
        if device is None:  # pragma: no cover - permission guarantees this
            raise NotFound("Device not found in session.")

        body = PlaceOrderSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        idem = request.META.get("HTTP_IDEMPOTENCY_KEY", "").strip()
        try:
            order = submit_order(
                session=session,
                device=device,
                lines=body.validated_data["lines"],
                idempotency_key=idem,
            )
        except (SessionError, OrderError) as exc:
            raise ValidationError(str(exc)) from exc

        if order.confirmation == "confirmed":
            broadcast_order_event(session.restaurant_id, _order_event_payload(order))
        broadcast_session_event(session.id, "order_placed", _order_event_payload(order))
        broadcast_session_event(session.id, "check_updated", None)

        return Response(
            OrderSerializer(order).data, status=status.HTTP_201_CREATED
        )


class SessionContactView(APIView):
    """POST contact details — resolve-or-create a CRM customer for the device."""

    permission_classes = [IsSessionParticipant]

    @extend_schema(
        request=ContactSerializer,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        device = getattr(request, "dining_device", None)
        if device is None:
            # Staff capturing on the guest's behalf must name the device.
            token = request.data.get("device_token")
            device = find_device(session, token)
        if device is None:
            raise ValidationError("A joined device is required for contact capture.")

        s = ContactSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        org_id = _org_id_for(session)
        attach_customer(
            session=session,
            device=device,
            org_id=org_id,
            phone=s.validated_data["phone"],
            name=s.validated_data.get("name", ""),
        )
        return _session_response(session, device)


class SessionPromoteView(APIView):
    """Staff anoints a device as the session leader (the ``leader`` mode flow)."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(
        request=PromoteSerializer,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = _get_session_or_404(pk)
        s = PromoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        device_id = s.validated_data.get("device_id")
        if device_id is not None:
            device = GuestDevice.all_objects.filter(session=session, id=device_id).first()
        else:
            device = find_device(session, s.validated_data["device_token"])
        if device is None:
            raise NotFound("Device not found in session.")
        try:
            promote_device(
                session=session,
                device=device,
                expected_version=s.validated_data.get("version"),
            )
        except SessionError as exc:
            if str(exc) == "stale_version":
                raise SessionStaleVersionError() from exc
            raise ValidationError(str(exc)) from exc
        broadcast_session_event(
            session.id, "leader_changed", {"leader_device_id": str(device.id)}
        )
        return _session_response(session)


class SessionConfirmView(APIView):
    """Staff fires a batch of pending orders (the ``waiter_confirm`` flow)."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(
        request=ConfirmOrdersSerializer,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = _get_session_or_404(pk)
        s = ConfirmOrdersSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        fired = confirm_orders(session=session, order_ids=s.validated_data["order_ids"])
        for order in fired:
            broadcast_order_event(session.restaurant_id, _order_event_payload(order))
        if fired:
            broadcast_session_event(session.id, "order_confirmed", None)
            broadcast_session_event(session.id, "check_updated", None)
        return _session_response(session)


class SessionRequestBillView(APIView):
    """A joined device (or staff) requests the bill."""

    permission_classes = [IsSessionParticipant]

    @extend_schema(
        request=None,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        device = getattr(request, "dining_device", None)
        try:
            request_bill(session=session)
        except SessionError as exc:
            raise ValidationError(str(exc)) from exc
        broadcast_session_event(session.id, "bill_requested", None)
        return _session_response(session, device)


def _service_request_payload(req: Any) -> dict[str, Any]:
    return {
        "id": str(req.id),
        "code": req.code,
        "table_id": str(req.table_id),
        "type": req.type,
        "status": req.status,
        "note": req.note,
    }


class SessionServiceRequestView(APIView):
    """A joined device raises a service request (call waiter / water / bill).

    Lands on the shared ``ops.ServiceRequest`` queue the staff floor already
    reads — staff claim/resolve via the ops floor endpoints (``/api/ops/requests/``).
    """

    authentication_classes: list = []
    permission_classes = [IsSessionParticipant]

    @extend_schema(
        request=ServiceRequestCreateSerializer,
        responses={201: ServiceRequestSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        device = getattr(request, "dining_device", None)
        s = ServiceRequestCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            req = create_service_request(
                session=session,
                device=device,
                kind=s.validated_data["kind"],
                note=s.validated_data.get("note", ""),
            )
        except SessionError as exc:
            raise ValidationError(str(exc)) from exc
        broadcast_service_request_event(
            session.restaurant_id, _service_request_payload(req)
        )
        broadcast_session_event(session.id, "service_requested", _service_request_payload(req))
        return Response(
            ServiceRequestSerializer(req).data, status=status.HTTP_201_CREATED
        )


class SessionCloseView(APIView):
    """Staff settles and closes the session, freeing the table."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(
        request=None,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = _get_session_or_404(pk)
        close_session(session=session)
        broadcast_session_event(session.id, "session_closed", None)
        return _session_response(session)


class SessionPayView(APIView):
    """Create a Razorpay order for the session's bill (device or staff)."""

    permission_classes = [IsSessionParticipant]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "dining_pay"

    @extend_schema(
        request=None,
        responses={200: PayResultSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = getattr(request, "dining_session", None) or _get_session_or_404(pk)
        try:
            result = create_check_payment(session)
        except CheckPaymentError as exc:
            raise ValidationError(str(exc)) from exc
        except (RazorpayConfigError, RazorpayError) as exc:
            # Never surface internal gateway detail to the client.
            logger.warning("Razorpay order creation failed for session %s: %s", pk, exc)
            raise PaymentUnavailableError() from exc
        return Response(PayResultSerializer(result).data)


class SessionSettleCashView(APIView):
    """Staff settles the bill in cash / at the counter (audited)."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(
        request=None,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = _get_session_or_404(pk)
        try:
            settle_check_cash(session, get_current_membership_id())
        except CheckPaymentError as exc:
            raise ValidationError(str(exc)) from exc
        broadcast_session_event(session.id, "check_updated", None)
        return _session_response(session)


class SessionDisputeView(APIView):
    """Staff flags the bill disputed (walkout / contested); audited."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    @extend_schema(
        request=DisputeSerializer,
        responses={200: DiningSessionSerializer},
        tags=["dining"],
    )
    def post(self, request: Request, pk: Any) -> Response:
        session = _get_session_or_404(pk)
        s = DisputeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            mark_check_disputed(
                session, get_current_membership_id(), s.validated_data["reason"]
            )
        except CheckPaymentError as exc:
            raise ValidationError(str(exc)) from exc
        broadcast_session_event(session.id, "check_updated", None)
        return _session_response(session)
