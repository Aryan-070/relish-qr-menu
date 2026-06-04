"""The guarded seed endpoint runs the demo seed only with the right token."""
import pytest
from django.test import override_settings

from accounts.models import Restaurant

pytestmark = pytest.mark.django_db


@override_settings(SEED_TOKEN="")
def test_seed_endpoint_404_when_token_unset(api_client):
    resp = api_client.post("/api/admin/seed-demo/", HTTP_X_SEED_TOKEN="anything")
    assert resp.status_code == 404


@override_settings(SEED_TOKEN="s3cret")
def test_seed_endpoint_404_on_wrong_token(api_client):
    resp = api_client.post("/api/admin/seed-demo/", HTTP_X_SEED_TOKEN="nope")
    assert resp.status_code == 404
    assert not Restaurant.objects.filter(published=True).exists()


@override_settings(SEED_TOKEN="s3cret")
def test_seed_endpoint_seeds_with_correct_token(api_client):
    resp = api_client.post("/api/admin/seed-demo/", HTTP_X_SEED_TOKEN="s3cret")
    assert resp.status_code == 200
    assert resp.data["success"] is True
    assert resp.data["restaurant_id"]
    assert resp.data["public_menu"].endswith("/")
    assert Restaurant.objects.filter(published=True).exists()
