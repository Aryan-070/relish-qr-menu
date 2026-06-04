"""Readiness probe checks DB + cache connectivity."""
import pytest


@pytest.mark.django_db
def test_readiness_ok(api_client):
    resp = api_client.get("/api/health/ready/")
    assert resp.status_code == 200
    assert resp.data["status"] == "ready"
    assert resp.data["checks"] == {"database": True, "cache": True}


def test_liveness_ok(api_client):
    resp = api_client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.data["status"] == "ok"
