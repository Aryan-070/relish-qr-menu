"""Operational views owned by the ``common`` app."""
from __future__ import annotations

from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Unauthenticated liveness probe used by load balancers and uptime checks."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response(
            {
                "status": "ok",
                "service": "relish-backend",
                "time": timezone.now().isoformat(),
            }
        )
