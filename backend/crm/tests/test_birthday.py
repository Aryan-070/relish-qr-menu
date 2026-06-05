"""Tests for the birthday-campaign trigger."""
from __future__ import annotations

from datetime import date

import pytest

from crm.birthday_services import run_birthday_campaign
from crm.models import BirthdayGreeting, Customer

pytestmark = pytest.mark.django_db

ORG = "11111111-1111-1111-1111-111111111111"
RUN = date(2026, 8, 15)


def _customer(phone: str, *, month: int, day: int, name: str = "Guest") -> Customer:
    # Birthday stored day+month with the sentinel year 2000 (matches capture).
    return Customer.objects.create(
        org_id=ORG, name=name, phone=phone, birth_date=date(2000, month, day)
    )


def test_greets_todays_birthdays_with_bonus_and_returns_numbers():
    match = _customer("+919800000001", month=8, day=15, name="Asha")
    _customer("+919800000002", month=1, day=1, name="Other")  # not today
    _customer("+919800000003", month=8, day=16, name="Tomorrow")  # not today

    before = match.points
    greeted = run_birthday_campaign(on=RUN, bonus_points=100)

    assert [g["phone"] for g in greeted] == ["+919800000001"]
    assert greeted[0]["name"] == "Asha"
    assert greeted[0]["bonus_points"] == 100

    match.refresh_from_db()
    assert match.points == before + 100
    g = BirthdayGreeting.objects.get(customer=match, year=2026)
    assert g.sent_at is not None


def test_idempotent_same_year_does_not_double_grant():
    match = _customer("+919800000004", month=8, day=15)
    first = run_birthday_campaign(on=RUN, bonus_points=100)
    assert len(first) == 1
    match.refresh_from_db()
    points_after_first = match.points

    second = run_birthday_campaign(on=RUN, bonus_points=100)
    assert second == []  # nobody greeted twice
    match.refresh_from_db()
    assert match.points == points_after_first
    assert BirthdayGreeting.objects.filter(customer=match).count() == 1


def test_zero_bonus_skips_points_but_still_logs():
    match = _customer("+919800000005", month=8, day=15)
    before = match.points
    greeted = run_birthday_campaign(on=RUN, bonus_points=0)
    assert len(greeted) == 1
    match.refresh_from_db()
    assert match.points == before
    assert BirthdayGreeting.objects.filter(customer=match, year=2026).exists()


def test_org_scoping():
    _customer("+919800000006", month=8, day=15)
    other_org_match = Customer.objects.create(
        org_id="22222222-2222-2222-2222-222222222222",
        name="Far", phone="+919800000007", birth_date=date(2000, 8, 15),
    )
    greeted = run_birthday_campaign(on=RUN, bonus_points=0, org_id=ORG)
    phones = {g["phone"] for g in greeted}
    assert "+919800000006" in phones
    assert other_org_match.phone not in phones
