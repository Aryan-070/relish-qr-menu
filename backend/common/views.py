"""Operational views owned by the ``common`` app."""
from __future__ import annotations

import io
import logging

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """Unauthenticated liveness probe used by load balancers and uptime checks."""

    permission_classes = [AllowAny]

    @extend_schema(
        auth=[],
        responses={
            200: inline_serializer(
                "HealthResponse",
                {
                    "status": serializers.CharField(),
                    "service": serializers.CharField(),
                    "time": serializers.DateTimeField(),
                },
            )
        },
        tags=["ops"],
    )
    def get(self, request: Request) -> Response:
        return Response(
            {
                "status": "ok",
                "service": "relish-backend",
                "time": timezone.now().isoformat(),
            }
        )


class ReadinessView(APIView):
    """Readiness probe: verifies the DB and cache are reachable.

    Returns 200 only when every dependency check passes, else 503 — so an
    orchestrator can hold traffic until the instance is truly ready.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        auth=[],
        responses={
            200: inline_serializer(
                "ReadinessResponse",
                {
                    "status": serializers.CharField(),
                    "checks": inline_serializer(
                        "ReadinessChecks",
                        {
                            "database": serializers.BooleanField(),
                            "cache": serializers.BooleanField(),
                        },
                    ),
                },
            )
        },
        tags=["ops"],
    )
    def get(self, request: Request) -> Response:
        checks = {"database": self._check_db(), "cache": self._check_cache()}
        ok = all(checks.values())
        return Response(
            {"status": "ready" if ok else "degraded", "checks": checks},
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @staticmethod
    def _check_db() -> bool:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return True
        except Exception:  # noqa: BLE001 - probe must never raise
            logger.exception("readiness: database check failed")
            return False

    @staticmethod
    def _check_cache() -> bool:
        try:
            cache.set("readiness:ping", "1", 5)
            return cache.get("readiness:ping") == "1"
        except Exception:  # noqa: BLE001 - probe must never raise
            logger.exception("readiness: cache check failed")
            return False


class SeedDemoView(APIView):
    """Run the idempotent demo seed in-process, guarded by a secret token.

    Triggered manually (e.g. once after deploy) on hosts without a shell. Runs
    inside the web worker — no second process, so it can't be OOM-killed on a
    small instance — and returns the result (or the real error) so the caller
    can see what happened. Disabled unless ``SEED_TOKEN`` is set; the request
    must send a matching ``X-Seed-Token`` header.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        auth=[],
        request=None,
        responses={
            200: inline_serializer(
                "SeedDemoResult",
                {
                    "success": serializers.BooleanField(),
                    "restaurant_id": serializers.CharField(allow_null=True),
                    "public_menu": serializers.CharField(allow_null=True),
                    "output": serializers.CharField(),
                },
            )
        },
        tags=["ops"],
    )
    def post(self, request: Request) -> Response:
        token = getattr(settings, "SEED_TOKEN", "") or ""
        if not token or request.headers.get("X-Seed-Token") != token:
            return Response(
                {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
            )

        buffer = io.StringIO()
        try:
            call_command("seed_demo", stdout=buffer)
        except Exception as exc:  # noqa: BLE001 - surface the real error to caller
            logger.exception("seed_demo failed")
            return Response(
                {"success": False, "error": str(exc), "output": buffer.getvalue()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        from accounts.models import Restaurant

        restaurant = (
            Restaurant.objects.filter(published=True).order_by("created_at").first()
        )
        return Response(
            {
                "success": True,
                "restaurant_id": str(restaurant.id) if restaurant else None,
                "public_menu": (
                    f"/api/public/menu/{restaurant.id}/" if restaurant else None
                ),
                "output": buffer.getvalue(),
            }
        )
