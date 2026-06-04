import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(email="owner@relish.test", password=VALID_PASSWORD)


# --- Manager ----------------------------------------------------------------


def test_create_user_normalizes_email_and_hashes_password():
    user = User.objects.create_user(
        email="Owner@Relish.TEST", password=VALID_PASSWORD
    )
    # normalize_email lowercases the domain part.
    assert user.email == "Owner@relish.test"
    # Password is hashed, not stored in plaintext.
    assert user.password != VALID_PASSWORD
    assert user.check_password(VALID_PASSWORD)
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=VALID_PASSWORD)


def test_create_superuser_sets_flags():
    admin = User.objects.create_superuser(
        email="admin@relish.test", password=VALID_PASSWORD
    )
    assert admin.is_staff is True
    assert admin.is_superuser is True
    assert admin.is_active is True
    assert admin.check_password(VALID_PASSWORD)


# --- Signup endpoint --------------------------------------------------------


def test_signup_creates_user(api_client):
    url = reverse("accounts:signup")
    resp = api_client.post(
        url, {"email": "new@relish.test", "password": VALID_PASSWORD}, format="json"
    )
    assert resp.status_code == 201
    assert resp.data["email"] == "new@relish.test"
    # Password must never be echoed back.
    assert "password" not in resp.data
    assert User.objects.filter(email="new@relish.test").exists()


def test_signup_rejects_weak_password(api_client):
    url = reverse("accounts:signup")
    resp = api_client.post(
        url, {"email": "weak@relish.test", "password": "123"}, format="json"
    )
    assert resp.status_code == 400
    # Errors flow through common.exceptions.custom_exception_handler, which wraps
    # them in the {success, error, detail} envelope; field errors live under detail.
    assert "password" in resp.data["detail"]
    assert not User.objects.filter(email="weak@relish.test").exists()


def test_signup_rejects_duplicate_email(api_client, user):
    url = reverse("accounts:signup")
    resp = api_client.post(
        url, {"email": user.email, "password": VALID_PASSWORD}, format="json"
    )
    assert resp.status_code == 400
    assert "email" in resp.data["detail"]


# --- Token endpoint ---------------------------------------------------------


def test_token_obtain_returns_pair_with_tenancy_claims(api_client, user):
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"email": user.email, "password": VALID_PASSWORD}, format="json"
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data

    decoded = AccessToken(resp.data["access"])
    # Forward-compatible placeholder claims must be present (None is fine).
    assert "membership_id" in decoded
    assert "restaurant_id" in decoded
    assert "org_id" in decoded
    assert decoded["membership_id"] is None
    assert decoded["restaurant_id"] is None
    assert decoded["org_id"] is None


def test_token_obtain_rejects_bad_credentials(api_client, user):
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"email": user.email, "password": "wrong-password"}, format="json"
    )
    assert resp.status_code == 401


# --- Me endpoint ------------------------------------------------------------


def test_me_requires_authentication(api_client):
    url = reverse("accounts:me")
    resp = api_client.get(url)
    assert resp.status_code == 401


def test_me_returns_current_user(api_client, user):
    api_client.force_authenticate(user=user)
    url = reverse("accounts:me")
    resp = api_client.get(url)
    assert resp.status_code == 200
    assert resp.data["email"] == user.email
    assert resp.data["id"] == str(user.id)
