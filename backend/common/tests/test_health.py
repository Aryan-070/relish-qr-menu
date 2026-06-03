"""Tests for the health probe endpoint (no DB access required)."""
from __future__ import annotations

from django.urls import reverse


def test_health_returns_ok(api_client):
    response = api_client.get(reverse("common:health"))

    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["service"] == "relish-backend"
    assert "time" in response.data


def test_health_via_url_path(api_client):
    response = api_client.get("/api/health/")

    assert response.status_code == 200
    assert response.data["status"] == "ok"
