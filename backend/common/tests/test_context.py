"""Tests for the active-tenant contextvar round-trip."""
from __future__ import annotations

from common.context import (
    get_current_org_id,
    get_current_restaurant_id,
    reset_current_tenant,
    set_current_tenant,
)


def test_defaults_are_none():
    assert get_current_restaurant_id() is None
    assert get_current_org_id() is None


def test_set_get_reset_round_trip():
    token = set_current_tenant("rest-123", "org-456")
    try:
        assert get_current_restaurant_id() == "rest-123"
        assert get_current_org_id() == "org-456"
    finally:
        reset_current_tenant(token)

    assert get_current_restaurant_id() is None
    assert get_current_org_id() is None


def test_values_are_coerced_to_str():
    token = set_current_tenant(123, 456)
    try:
        assert get_current_restaurant_id() == "123"
        assert get_current_org_id() == "456"
    finally:
        reset_current_tenant(token)


def test_nested_set_restores_outer():
    outer = set_current_tenant("rest-a", "org-a")
    try:
        inner = set_current_tenant("rest-b", "org-b")
        try:
            assert get_current_restaurant_id() == "rest-b"
        finally:
            reset_current_tenant(inner)
        assert get_current_restaurant_id() == "rest-a"
    finally:
        reset_current_tenant(outer)
    assert get_current_restaurant_id() is None
