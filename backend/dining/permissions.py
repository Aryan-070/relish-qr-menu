"""Guest-device authorization for the dining API.

Guest endpoints carry no JWT — identity is the opaque ``X-Device-Token`` header
minted at join. These permission classes resolve that token *against the session
in the URL* (so a token from a previous epoch never authorizes the current one)
and stash the resolved device on the request for the view to reuse. The frontend
order button is cosmetic; THIS is where ordering authority is enforced.
"""
from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission

from .models import DiningSession
from .services import device_can_order, find_device

_DEVICE_HEADER = "HTTP_X_DEVICE_TOKEN"


def _is_staff(request: Any) -> bool:
    """True when the caller is an authenticated staff member or superuser."""
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    from common.context import get_current_org_id

    return get_current_org_id() is not None


def _resolve_session(view: Any) -> DiningSession | None:
    pk = view.kwargs.get("pk")
    if pk is None:
        return None
    return DiningSession.all_objects.filter(pk=pk).first()


def _resolve_device(request: Any, session: DiningSession):
    token = request.META.get(_DEVICE_HEADER, "").strip()
    device = find_device(session, token) if token else None
    if device is not None:
        # Cache for the view so it doesn't re-query.
        request.dining_session = session
        request.dining_device = device
    return device


class IsSessionParticipant(BasePermission):
    """Allow a joined device (any role) or a staff member to read the session."""

    message = "You must have joined this session (or be staff) to view it."

    def has_permission(self, request: Any, view: Any) -> bool:
        session = _resolve_session(view)
        if session is None:
            return False
        request.dining_session = session
        if _is_staff(request):
            return True
        return _resolve_device(request, session) is not None


class CanSubmitOrder(BasePermission):
    """Allow an order POST only when the device may order under session policy.

    ``auto_fire`` → any joined device. ``waiter_confirm`` → any joined device
    (the order lands pending). ``leader`` → only the anointed leader device.
    """

    message = "This device is not allowed to place orders in this session yet."

    def has_permission(self, request: Any, view: Any) -> bool:
        session = _resolve_session(view)
        if session is None or not session.is_live:
            return False
        device = _resolve_device(request, session)
        return device_can_order(session, device)
