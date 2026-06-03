"""Root pytest fixtures shared across all backend apps."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.fixture()
def api_client() -> APIClient:
    """An unauthenticated DRF test client."""
    return APIClient()
