"""Seed The Table Theory demo tenant end-to-end so the /qsr guest flow works
against real backend data: an org + published restaurant + ACTIVE subscription
(required for the public menu to serve), a handful of tables, and the full QSR
menu keyed by ``code == qsrMenu item id`` so the frontend can map cart lines to
real ``MenuItem`` UUIDs and submit genuine orders.

Idempotent (get_or_create throughout). Prints the restaurant id + a table id to
paste into ``/qsr?r=<rid>&t=<tid>``.

    python manage.py seed_table_theory
"""
from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Organization, Restaurant
from billing.models import Subscription
from menu.models import MenuCategory, MenuItem
from ops.models import RestaurantTable

# category_code -> (name, sort_order, [(item_code, item_name, rupees), ...])
MENU: dict[str, tuple[str, int, list[tuple[str, str, int]]]] = {
    "bowls": ("Signature Bowls", 1, [
        ("ttb-byo", "Build Your Own Bowl", 169),
        ("ttb-butterpaneer", "Butter Paneer Bowl", 229),
        ("ttb-tandooripaneer", "Tandoori Paneer Bowl", 239),
        ("ttb-smokychicken", "Smoky Chicken Bowl", 269),
        ("ttb-butterchicken", "Butter Chicken Bowl", 289),
        ("ttb-koreanveg", "Korean Veg Bowl", 249),
        ("ttb-koreanchicken", "Korean Chicken Bowl", 299),
        ("ttb-teriyaki", "Teriyaki Chicken Bowl", 309),
        ("ttb-schezwanpaneer", "Schezwan Paneer Bowl", 249),
        ("ttb-grilledprotein", "Grilled Chicken Protein Bowl", 319),
        ("ttb-vegpower", "Veg Power Bowl", 249),
        ("ttb-paneercorn", "Paneer & Corn Fresh Bowl", 259),
    ]),
    "wraps": ("Signature Wraps", 2, [
        ("ttw-tandooripaneer", "Tandoori Paneer Wrap", 169),
        ("ttw-periveggie", "Peri Peri Veggie Wrap", 159),
        ("ttw-schezwancorn", "Schezwan Corn & Cheese Wrap", 179),
        ("ttw-mushroom", "Crispy Mushroom Wrap", 189),
        ("ttw-smokychicken", "Smoky Chicken Wrap", 209),
        ("ttw-koreanchicken", "Korean Chicken Wrap", 219),
        ("ttw-butterchicken", "Butter Chicken Wrap", 229),
        ("ttw-crispychicken", "Crispy Chicken Wrap", 209),
    ]),
    "sandwiches": ("Grilled Sandwiches", 3, [
        ("ttsw-threecheese", "Three Cheese Sandwich", 169),
        ("ttsw-pestocorn", "Pesto Corn Sandwich", 179),
        ("ttsw-paneertikka", "Paneer Tikka Sandwich", 199),
        ("ttsw-chickenmelt", "Chicken & Cheese Melt", 229),
        ("ttsw-spicychicken", "Spicy Chicken Sandwich", 239),
    ]),
    "pasta": ("Fresh Pasta", 4, [
        ("ttp-vegalfredo", "Creamy Veg Alfredo Pasta", 219),
        ("ttp-chickenalfredo", "Chicken Alfredo Pasta", 269),
        ("ttp-vegarrabbiata", "Arrabbiata Veg Pasta", 209),
        ("ttp-chickenarrabbiata", "Spicy Chicken Arrabbiata", 269),
    ]),
    "sides": ("Sides & Snacks", 5, [
        ("ttsd-fries", "Classic Fries", 99),
        ("ttsd-perifries", "Peri Peri Fries", 119),
        ("ttsd-cheesefries", "Loaded Cheese Fries", 179),
        ("ttsd-koreanfries", "Korean Loaded Fries", 199),
        ("ttsd-chickenpops", "Crispy Chicken Pops", 189),
        ("ttsd-garlicbread", "Garlic Breadsticks", 119),
        ("ttsd-nachos", "Nachos & Cheese Dip", 169),
    ]),
    "beverages": ("Drinks & Beverages", 6, [
        ("ttbev-cappuccino", "Cappuccino", 139),
        ("ttbev-coldcoffee", "Classic Cold Coffee", 159),
        ("ttbev-caramelfrappe", "Caramel Frappe", 199),
        ("ttbev-oreocoldcoffee", "Oreo Cold Coffee", 219),
        ("ttbev-mojito", "Mint Mojito", 139),
        ("ttbev-peachtea", "Peach Iced Tea", 149),
        ("ttbev-watermelon", "Watermelon Cooler", 159),
        ("ttbev-chocshake", "Belgian Chocolate Shake", 199),
        ("ttbev-brownieshake", "Brownie Shake", 219),
        ("ttbev-masalachai", "Masala Chai", 59),
        ("ttbev-kulhadchai", "Kulhad Chai", 79),
        ("ttbev-smokedcoffee", "Smoked Cold Coffee", 239),
        ("ttbev-nitro", "Nitro Coffee Cooler", 249),
    ]),
    "desserts": ("Desserts", 7, [
        ("ttdes-brownie", "Chocolate Brownie", 99),
        ("ttdes-browniecream", "Brownie with Ice Cream", 159),
        ("ttdes-chocjar", "Chocolate Dessert Jar", 179),
        ("ttdes-biscoffjar", "Lotus Biscoff Jar", 199),
    ]),
}

TABLES = [("T1", 4), ("T2", 2), ("T3", 6), ("T4", 4), ("T5", 2), ("T6", 8)]


class Command(BaseCommand):
    help = "Seed The Table Theory demo tenant (restaurant + menu + tables)."

    def handle(self, *args: object, **options: object) -> None:
        org, _ = Organization.objects.get_or_create(
            slug="the-table-theory", defaults={"name": "The Table Theory"}
        )
        restaurant, _ = Restaurant.objects.get_or_create(
            org=org,
            code="TTT",
            defaults={"name": "The Table Theory", "city": "Mumbai"},
        )
        # Public menu gate: published + active + an ACTIVE subscription.
        restaurant.published = True
        restaurant.active = True
        restaurant.save(update_fields=["published", "active"])
        # Idempotent on org (NOT on status) so a re-run after a lapse reactivates
        # the existing subscription rather than stacking duplicate ACTIVE rows.
        subscription, _ = Subscription.objects.get_or_create(
            org_id=org.id,
            defaults={
                "package": Subscription.Package.SIGNATURE,
                "status": Subscription.Status.ACTIVE,
                "renewal_at": timezone.now() + timedelta(days=365),
            },
        )
        if subscription.status != Subscription.Status.ACTIVE:
            subscription.status = Subscription.Status.ACTIVE
            subscription.save(update_fields=["status"])

        tables = {}
        for code, seats in TABLES:
            table, _ = RestaurantTable.all_objects.get_or_create(
                restaurant_id=restaurant.id,
                code=code,
                defaults={"label": code, "seats": seats},
            )
            tables[code] = table

        item_count = 0
        for cat_code, (cat_name, sort_order, items) in MENU.items():
            category, _ = MenuCategory.all_objects.get_or_create(
                restaurant_id=restaurant.id,
                code=cat_code,
                defaults={"name": cat_name, "sort_order": sort_order},
            )
            for item_code, item_name, rupees in items:
                _, created = MenuItem.all_objects.get_or_create(
                    restaurant_id=restaurant.id,
                    code=item_code,
                    defaults={
                        "category": category,
                        "name": item_name,
                        "price_minor": rupees * 100,
                        "available": True,
                    },
                )
                item_count += created

        self.stdout.write(self.style.SUCCESS("Seeded The Table Theory."))
        self.stdout.write(f"  restaurant_id = {restaurant.id}")
        self.stdout.write(f"  table T1 id   = {tables['T1'].id}")
        self.stdout.write(f"  menu items    = {MenuItem.all_objects.filter(restaurant_id=restaurant.id).count()} ({item_count} new)")
        self.stdout.write(
            f"  QR link       = /qsr?r={restaurant.id}&t={tables['T1'].id}"
        )
