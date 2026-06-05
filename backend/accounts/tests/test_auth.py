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
    return User.objects.create_user(
        username="owner", email="owner@relish.test", password=VALID_PASSWORD
    )


# --- Manager ----------------------------------------------------------------


def test_create_user_normalizes_email_and_hashes_password():
    user = User.objects.create_user(
        username="owner", email="Owner@Relish.TEST", password=VALID_PASSWORD
    )
    # normalize_email lowercases the domain part.
    assert user.email == "Owner@relish.test"
    # Password is hashed, not stored in plaintext.
    assert user.password != VALID_PASSWORD
    assert user.check_password(VALID_PASSWORD)
    assert user.is_active is True
    assert user.is_staff is False
    assert user.is_superuser is False


def test_create_user_requires_username():
    with pytest.raises(ValueError):
        User.objects.create_user(username="", password=VALID_PASSWORD)


def test_create_user_allows_missing_email():
    user = User.objects.create_user(username="rostered", password=VALID_PASSWORD)
    assert user.email is None


def test_create_superuser_sets_flags():
    admin = User.objects.create_superuser(
        username="admin", email="admin@relish.test", password=VALID_PASSWORD
    )
    assert admin.is_staff is True
    assert admin.is_superuser is True
    assert admin.is_active is True
    assert admin.check_password(VALID_PASSWORD)


# --- Token endpoint (username- or email-based login) ------------------------


def test_token_obtain_by_username(api_client, user):
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"username": user.username, "password": VALID_PASSWORD}, format="json"
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


def test_token_obtain_by_email(api_client, user):
    """The recovery email is accepted as the login identifier."""
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"username": user.email, "password": VALID_PASSWORD}, format="json"
    )
    assert resp.status_code == 200
    assert "access" in resp.data


def test_token_obtain_rejects_bad_credentials(api_client, user):
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"username": user.username, "password": "wrong-password"}, format="json"
    )
    assert resp.status_code == 401


def test_token_obtain_rejects_deactivated_user(api_client, user):
    user.is_active = False
    user.save(update_fields=["is_active"])
    url = reverse("accounts:token_obtain_pair")
    resp = api_client.post(
        url, {"username": user.username, "password": VALID_PASSWORD}, format="json"
    )
    assert resp.status_code == 401


def test_signup_route_removed():
    """Self-registration is intentionally gone (admin/manager create accounts)."""
    from django.urls import NoReverseMatch

    with pytest.raises(NoReverseMatch):
        reverse("accounts:signup")


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
    assert resp.data["username"] == user.username
    assert resp.data["email"] == user.email
    assert resp.data["id"] == str(user.id)
