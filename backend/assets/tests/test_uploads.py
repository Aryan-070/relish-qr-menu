"""Tests for the media-upload slice: presign + complete + lifecycle.

The whole point of this slice is that **bytes never touch the server** — the
client uploads directly to S3 / R2 via a presigned PUT URL. So every test patches
``assets.services._s3_client`` to a Mock (no network, no boto3 credentials) and
asserts only on what *we* control: the policy gate (content-type / size / quota),
the ``pending`` row we create, and the lifecycle transition on completion.

Auth is exercised end to end through a real signed JWT so
``common.middleware.TenantMiddleware`` runs and tenant scoping is genuinely
tested (not bypassed with ``force_authenticate``).
"""
from __future__ import annotations

from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Organization, Restaurant
from assets.models import MediaAsset

pytestmark = pytest.mark.django_db

User = get_user_model()

VALID_PASSWORD = "Str0ng-Relish-Pass!42"

# A small, valid image declaration reused across the happy-path tests.
SMALL_IMAGE = {
    "kind": "image",
    "content_type": "image/jpeg",
    "size_bytes": 1024,
}


# --- Fixtures / helpers ------------------------------------------------------


def _make_tenant(slug: str, code: str) -> tuple[Organization, Restaurant]:
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    restaurant = Restaurant.objects.create(org=org, name=f"Outlet {code}", code=code)
    return org, restaurant


def _auth_client(
    org: Organization,
    restaurant: Restaurant,
    *,
    email: str,
    perms: list[str],
) -> APIClient:
    """Return an APIClient authenticated as a member of ``restaurant``."""
    user = User.objects.create_user(email=email, password=VALID_PASSWORD)
    token = RefreshToken.for_user(user)
    token["restaurant_id"] = str(restaurant.id)
    token["org_id"] = str(org.id)
    token["perms"] = perms
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def tenant_a():
    return _make_tenant("org-a", "AAA")


@pytest.fixture
def tenant_b():
    return _make_tenant("org-b", "BBB")


@pytest.fixture
def editor_client(tenant_a):
    org, restaurant = tenant_a
    return _auth_client(
        org, restaurant, email="editor@relish.test", perms=["edit-menu"]
    )


@pytest.fixture
def viewer_client(tenant_a):
    org, restaurant = tenant_a
    return _auth_client(org, restaurant, email="viewer@relish.test", perms=[])


@pytest.fixture
def s3_mock():
    """Patch the boto3 seam so presign returns a fixed URL and never hits S3."""
    client = mock.Mock()
    client.generate_presigned_url.return_value = "https://example.test/put"
    with mock.patch("assets.services._s3_client", return_value=client):
        yield client


# --- Presign: happy path + RBAC ---------------------------------------------


@override_settings(ASSET_BUCKET="relish-media")
def test_presign_image_returns_201_and_creates_pending_asset(
    editor_client, s3_mock, tenant_a
):
    _org, restaurant = tenant_a

    resp = editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")

    assert resp.status_code == 201, resp.data
    assert resp.data["upload_url"] == "https://example.test/put"
    assert resp.data["key"].startswith(f"{restaurant.id}/image/")

    asset = MediaAsset.all_objects.get(pk=resp.data["asset_id"])
    assert asset.status == "pending"
    assert asset.bytes == 1024
    assert asset.bucket == "relish-media"
    assert str(asset.restaurant_id) == str(restaurant.id)
    # The presign request was for a PUT object — confirm we asked boto3 for one.
    args, kwargs = s3_mock.generate_presigned_url.call_args
    assert args[0] == "put_object"
    assert kwargs["Params"]["Bucket"] == "relish-media"


@override_settings(ASSET_BUCKET="relish-media")
def test_presign_requires_edit_menu_permission(viewer_client, s3_mock):
    resp = viewer_client.post("/api/media/presign/", SMALL_IMAGE, format="json")

    assert resp.status_code == 403, resp.data
    assert MediaAsset.all_objects.count() == 0


# --- Presign: MIME + size policy --------------------------------------------


@override_settings(ASSET_BUCKET="relish-media", ASSET_IMAGE_MAX_BYTES=2048)
def test_presign_rejects_oversized_image(editor_client, s3_mock):
    payload = {"kind": "image", "content_type": "image/jpeg", "size_bytes": 4096}

    resp = editor_client.post("/api/media/presign/", payload, format="json")

    assert resp.status_code == 400, resp.data
    assert MediaAsset.all_objects.count() == 0


@override_settings(
    ASSET_BUCKET="relish-media",
    ASSET_ALLOWED_IMAGE_TYPES=["image/jpeg", "image/png", "image/webp"],
)
def test_presign_rejects_disallowed_content_type(editor_client, s3_mock):
    payload = {
        "kind": "image",
        "content_type": "application/zip",
        "size_bytes": 1024,
    }

    resp = editor_client.post("/api/media/presign/", payload, format="json")

    assert resp.status_code == 400, resp.data
    assert MediaAsset.all_objects.count() == 0


# --- Presign: tenant quota ---------------------------------------------------


@override_settings(ASSET_BUCKET="relish-media", ASSET_TENANT_QUOTA_BYTES=1500)
def test_presign_enforces_tenant_quota(editor_client, s3_mock):
    # First 1024-byte upload fits under the 1500-byte quota.
    first = editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")
    assert first.status_code == 201, first.data

    # A second 1024-byte upload (1024 + 1024 = 2048 > 1500) must be rejected.
    second = editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")
    assert second.status_code == 400, second.data

    # Only the first asset was ever persisted.
    assert MediaAsset.all_objects.count() == 1


# --- Complete upload: lifecycle ---------------------------------------------


@override_settings(ASSET_BUCKET="relish-media")
def test_complete_image_marks_ready(editor_client, s3_mock):
    presign = editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")
    asset_id = presign.data["asset_id"]

    resp = editor_client.post(f"/api/media/{asset_id}/complete/", {}, format="json")

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "ready"
    assert MediaAsset.all_objects.get(pk=asset_id).status == "ready"


@override_settings(ASSET_BUCKET="relish-media")
def test_complete_video_processes_and_enqueues_transcode(editor_client, s3_mock):
    payload = {"kind": "video", "content_type": "video/mp4", "size_bytes": 50_000}
    presign = editor_client.post("/api/media/presign/", payload, format="json")
    asset_id = presign.data["asset_id"]

    with mock.patch("assets.tasks.transcode_asset") as transcode:
        resp = editor_client.post(
            f"/api/media/{asset_id}/complete/", {}, format="json"
        )

    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "processing"
    assert MediaAsset.all_objects.get(pk=asset_id).status == "processing"
    transcode.delay.assert_called_once_with(asset_id)


# --- Cross-tenant isolation --------------------------------------------------


@override_settings(ASSET_BUCKET="relish-media")
def test_cannot_complete_other_tenants_asset(
    editor_client, s3_mock, tenant_a, tenant_b
):
    # Tenant A creates an asset.
    presign = editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")
    asset_id = presign.data["asset_id"]

    # Tenant B's editor cannot complete it.
    org_b, restaurant_b = tenant_b
    other = _auth_client(
        org_b, restaurant_b, email="b-editor@relish.test", perms=["edit-menu"]
    )
    resp = other.post(f"/api/media/{asset_id}/complete/", {}, format="json")

    assert resp.status_code == 404, resp.data
    assert MediaAsset.all_objects.get(pk=asset_id).status == "pending"


@override_settings(ASSET_BUCKET="relish-media")
def test_list_is_tenant_scoped(editor_client, s3_mock, tenant_a, tenant_b):
    # Tenant A creates one asset.
    editor_client.post("/api/media/presign/", SMALL_IMAGE, format="json")

    # Tenant B sees none of tenant A's assets.
    org_b, restaurant_b = tenant_b
    other = _auth_client(
        org_b, restaurant_b, email="b-viewer@relish.test", perms=[]
    )
    resp = other.get("/api/media/assets/")

    assert resp.status_code == 200, resp.data
    assert resp.data["results"] == []
