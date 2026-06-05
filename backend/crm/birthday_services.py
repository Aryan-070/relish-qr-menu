"""Birthday-campaign trigger.

Finds customers whose stored birthday (day+month; year is a sentinel) matches a
run date, records a one-per-year :class:`crm.models.BirthdayGreeting` (idempotent
re-runs), optionally grants a birthday bonus, and returns the contact list a
messaging channel would send to. There is no SMS/WhatsApp gateway yet — this is
the trigger + outreach log + numbers; a real sender consumes the un-sent rows.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from django.db import transaction
from django.utils import timezone

from crm.loyalty_services import earn_points
from crm.models import BirthdayGreeting, Customer

#: Default loyalty points granted as a birthday treat.
DEFAULT_BIRTHDAY_BONUS = 100


def customers_with_birthday(on: date, org_id: Any | None = None):
    """Customers whose birthday (month+day) falls on ``on`` (year ignored)."""
    qs = Customer.objects.filter(
        birth_date__month=on.month,
        birth_date__day=on.day,
        deleted_at__isnull=True,
    )
    if org_id is not None:
        qs = qs.filter(org_id=org_id)
    return qs


@transaction.atomic
def run_birthday_campaign(
    *,
    on: date | None = None,
    bonus_points: int = DEFAULT_BIRTHDAY_BONUS,
    org_id: Any | None = None,
) -> list[dict[str, Any]]:
    """Greet every customer whose birthday is ``on`` (default: today).

    Idempotent per ``(customer, year)`` — re-running the same day greets nobody
    twice and never double-grants the bonus. Returns one dict per *newly* greeted
    customer (``{customer_id, name, phone, bonus_points}``) — the numbers to message.
    """
    run_on = on or timezone.localdate()
    greeted: list[dict[str, Any]] = []

    for customer in customers_with_birthday(run_on, org_id):
        greeting, created = BirthdayGreeting.objects.get_or_create(
            customer=customer,
            year=run_on.year,
            defaults={"org_id": customer.org_id, "bonus_points": bonus_points},
        )
        if not created:
            continue  # already greeted this year

        if bonus_points > 0:
            earn_points(customer, bonus_points, reason="adjust")

        greeting.sent_at = timezone.now()
        greeting.save(update_fields=["sent_at", "updated_at"])
        greeted.append(
            {
                "customer_id": str(customer.id),
                "name": customer.name,
                "phone": customer.phone,
                "bonus_points": bonus_points,
            }
        )

    return greeted
