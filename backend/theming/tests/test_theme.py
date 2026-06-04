"""Tests for the theming console slice (config CRUD + draft/publish)."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Organization, Restaurant
from theming.models import RestaurantTheme
from theming.services import public_theme_config

User = get_user_model()

pytestmark = pytest.mark.django_db


def _make_tenant():
    org = Organization.objects.create(name="Relish Diner", slug="relish-diner")
    restaurant = Restaurant.objects.create(org=org, name="Main", code="MAIN")
    return org, restaurant


def _client(org, restaurant, perms):
    user = User.objects.create_user(email="manager@relish.test", password="Sup3r!pass")
    token = RefreshToken.for_user(user)
    token["org_id"] = str(org.id)
    token["restaurant_id"] = str(restaurant.id)
    token["perms"] = list(perms)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def test_get_auto_creates_default_theme():
    org, restaurant = _make_tenant()
    client = _client(org, restaurant, perms=["manage-theme"])

    assert not RestaurantTheme.objects.filter(restaurant_id=restaurant.id).exists()

    resp = client.get(reverse("theming:theme"))

    assert resp.status_code == 200
    assert resp.data["ui_theme"] == "warm"
    assert resp.data["component_style"] == "classic"
    assert RestaurantTheme.objects.filter(restaurant_id=restaurant.id).exists()


def test_put_updates_ui_theme_with_permission():
    org, restaurant = _make_tenant()
    client = _client(org, restaurant, perms=["manage-theme"])

    resp = client.put(
        reverse("theming:theme"), {"ui_theme": "editorial"}, format="json"
    )

    assert resp.status_code == 200
    assert resp.data["ui_theme"] == "editorial"
    theme = RestaurantTheme.objects.get(restaurant_id=restaurant.id)
    assert theme.ui_theme == "editorial"


def test_put_without_permission_is_forbidden():
    org, restaurant = _make_tenant()
    client = _client(org, restaurant, perms=[])

    resp = client.put(
        reverse("theming:theme"), {"ui_theme": "editorial"}, format="json"
    )

    assert resp.status_code == 403


def test_draft_then_publish_promotes_live_config():
    org, restaurant = _make_tenant()
    client = _client(org, restaurant, perms=["manage-theme"])

    draft_resp = client.put(
        reverse("theming:theme_draft"),
        {"draft": {"ui_theme": "brutalist", "component_style": "spectacle"}},
        format="json",
    )
    assert draft_resp.status_code == 200
    assert draft_resp.data["draft"]["ui_theme"] == "brutalist"

    # Live config is untouched until publish.
    theme = RestaurantTheme.objects.get(restaurant_id=restaurant.id)
    assert theme.ui_theme == "warm"
    assert theme.published is False

    publish_resp = client.post(reverse("theming:theme_publish"))
    assert publish_resp.status_code == 200
    assert publish_resp.data["ui_theme"] == "brutalist"
    assert publish_resp.data["component_style"] == "spectacle"

    theme.refresh_from_db()
    assert theme.published is True
    assert theme.ui_theme == "brutalist"
    assert theme.component_style == "spectacle"
    assert theme.draft == {}


def test_public_theme_config_returns_only_safe_fields():
    org, restaurant = _make_tenant()
    RestaurantTheme.objects.create(
        restaurant=restaurant,
        ui_theme="editorial",
        draft={"ui_theme": "warm"},
        published=True,
    )

    config = public_theme_config(restaurant.id)

    assert config["ui_theme"] == "editorial"
    assert "draft" not in config
    assert "published" not in config
    assert "created_at" not in config
    assert set(config.keys()) == {
        "ui_theme",
        "component_style",
        "media_mode",
        "token_overrides",
        "allow_customer_choice",
        "customer_choices",
        "logo_url",
        "cover_url",
    }


def test_public_theme_config_default_when_no_row():
    org, restaurant = _make_tenant()

    config = public_theme_config(restaurant.id)

    assert config["ui_theme"] == "warm"
    assert config["component_style"] == "classic"
    assert config["media_mode"] == "image"
    assert config["token_overrides"] == {}
