"""Run the birthday campaign for a date (default today).

Cron-friendly: ``python manage.py birthday_campaign`` daily greets every
customer whose birthday is today (once per year), grants a bonus, and prints the
contact numbers to message. Idempotent — safe to re-run.

    python manage.py birthday_campaign                 # today, +100 pts
    python manage.py birthday_campaign --date 2026-08-15 --bonus 0
"""
from __future__ import annotations

from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from crm.birthday_services import DEFAULT_BIRTHDAY_BONUS, run_birthday_campaign


class Command(BaseCommand):
    help = "Greet customers whose birthday is today (idempotent); print the numbers to message."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--date", help="Run date as YYYY-MM-DD (default: today).")
        parser.add_argument(
            "--bonus",
            type=int,
            default=DEFAULT_BIRTHDAY_BONUS,
            help=f"Loyalty points to grant (default {DEFAULT_BIRTHDAY_BONUS}; 0 = none).",
        )

    def handle(self, *args, **options) -> None:
        if options.get("date"):
            try:
                run_on = date.fromisoformat(options["date"])
            except ValueError as exc:
                raise CommandError("--date must be YYYY-MM-DD.") from exc
        else:
            run_on = timezone.localdate()

        greeted = run_birthday_campaign(on=run_on, bonus_points=options["bonus"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Birthdays on {run_on:%d %b}: {len(greeted)} customer(s) greeted."
            )
        )
        for r in greeted:
            self.stdout.write(f"  {r['name'] or '(no name)'} — {r['phone']}  (+{r['bonus_points']} pts)")
        if not greeted:
            self.stdout.write("  (none today, or all already greeted this year)")
