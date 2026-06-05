"""Seed a fully-public demo restaurant so the live API serves realistic content.

Idempotent — keyed on the demo user / org slug, using get_or_create throughout,
so it is safe to run on every deploy. Mirrors the frontend demo menu
(src/data/menu.ts): 5 categories, ~30 items, 14 tables, a sample customer +
order, a published theme and an active subscription. After it runs,
``is_restaurant_public`` is true, so ``GET /api/public/menu/<id>/`` returns
``available: true`` with the full menu.

Run it locally:  python manage.py seed_demo
On Render (no shell): set SEED_DEMO=true and redeploy (start.sh runs it).
"""
from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Restaurant
from accounts.services.provisioning import provision_org
from billing.models import Subscription
from crm.models import Customer
from menu.models import MenuCategory, MenuItem
from ops.models import ORDER_STATUS_CHOICES, Order, OrderLine, RestaurantTable
from theming.models import RestaurantTheme

DEMO_EMAIL = "demo@relish.test"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "relish-demo-2026"
DEMO_ORG = "Relish Demo"
DEMO_OUTLET = "Relish Demo Outlet"

# (code, name, rupees, opts) per category — prices ×100 → paise at insert.
MENU: dict[str, tuple[str, int, list]] = {
    "beverages": ("Beverages", 1, [
        ("bev-001", "Fresh Lime Soda", 120, {"jain": True, "tags": ["refreshing", "summer", "light"]}),
        ("bev-002", "Masala Chai", 90, {"jain": True, "tags": ["warm", "spiced", "classic"]}),
        ("bev-003", "Cold Coffee", 160, {"tags": ["cold", "indulgent", "coffee"]}),
        ("bev-004", "Mango Lassi", 150, {"tags": ["fruity", "thick", "summer"]}),
        ("bev-005", "Virgin Mojito", 170, {"jain": True, "tags": ["refreshing", "minty", "fizzy"]}),
        ("bev-006", "Watermelon Cooler", 140, {"jain": True, "tags": ["fruity", "seasonal", "light"]}),
    ]),
    "soups": ("Soups", 2, [
        ("soup-001", "Tomato Basil Bisque", 180, {"can_be_jain": True, "tags": ["classic", "comfort", "creamy"]}),
        ("soup-002", "Sweet Corn Soup", 160, {"can_be_jain": True, "tags": ["mild", "comfort"]}),
        ("soup-003", "Hot & Sour Soup", 170, {"spice": 2, "tags": ["spicy", "tangy"]}),
        ("soup-004", "Minestrone", 190, {"tags": ["italian", "hearty"]}),
        ("soup-005", "Cream of Mushroom", 200, {"tags": ["creamy", "earthy"]}),
    ]),
    "quickbites": ("Quick Bites", 3, [
        ("qb-001", "Veg Platter", 240, {"tags": ["sharing", "crispy"]}),
        ("qb-002", "Loaded Nachos", 260, {"tags": ["cheesy", "sharing"]}),
        ("qb-003", "Spring Rolls", 180, {"tags": ["crispy", "asian"]}),
        ("qb-004", "Cheesy Garlic Bread", 190, {"tags": ["cheesy", "bread"]}),
        ("qb-005", "Paneer Tikka", 260, {"can_be_jain": True, "chef": True, "spice": 1, "tags": ["Indian", "tandoor", "popular"]}),
        ("qb-006", "Bruschetta Classica", 210, {"tags": ["italian", "fresh"]}),
    ]),
    "italian": ("Italian Fiesta", 4, [
        ("ita-001", "Penne Arrabbiata", 290, {"spice": 2, "tags": ["pasta", "spicy"]}),
        ("ita-002", "Pasta Aglio e Olio", 280, {"tags": ["pasta", "garlic"]}),
        ("ita-003", "Pesto Farfalle", 300, {"tags": ["pasta", "basil"]}),
        ("ita-004", "Margherita Pizza", 320, {"chef": True, "tags": ["pizza", "classic", "Italian"]}),
        ("ita-005", "Veg Lasagna", 340, {"tags": ["baked", "cheesy"]}),
        ("ita-006", "Risotto ai Funghi", 360, {"tags": ["creamy", "mushroom"]}),
    ]),
    "desserts": ("Desserts", 5, [
        ("des-001", "Tiramisu", 280, {"chef": True, "tags": ["Italian", "coffee", "creamy"]}),
        ("des-002", "Choco Lava Cake", 240, {"tags": ["chocolate", "warm"]}),
        ("des-003", "Gelato (2 scoops)", 180, {"tags": ["cold", "sweet"]}),
        ("des-004", "Gulab Jamun", 160, {"jain": True, "tags": ["Indian", "warm", "sweet"]}),
        ("des-005", "Mango Kulfi", 170, {"tags": ["Indian", "frozen"]}),
        ("des-006", "Pannacotta", 260, {"tags": ["Italian", "silky"]}),
    ]),
}

ZONES = ["Garden", "Indoor", "Patio", "Bar"]
SEATS = [2, 2, 4, 4, 4, 6]


class Command(BaseCommand):
    help = "Seed a fully-public demo restaurant (idempotent)."

    # No outer transaction: each step commits independently (provision_org keeps
    # its own atomic block). This keeps lock windows tiny and makes the seed
    # safe to run in the background while the web server is already serving.
    def handle(self, *args, **options) -> None:
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DEMO_USERNAME, defaults={"email": DEMO_EMAIL}
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=["password"])

        membership = provision_org(user, DEMO_ORG, DEMO_OUTLET)
        restaurant = (
            membership.outlets.select_related("restaurant").first().restaurant
        )

        # Make it publicly servable: published outlet + active subscription + theme.
        if not restaurant.published:
            restaurant.published = True
            restaurant.save(update_fields=["published", "updated_at"])

        Subscription.objects.get_or_create(
            org_id=restaurant.org_id,
            defaults={
                "package": Subscription.Package.SIGNATURE,
                "status": Subscription.Status.ACTIVE,
                "renewal_at": timezone.now() + timedelta(days=365),
            },
        )
        RestaurantTheme.objects.update_or_create(
            restaurant=restaurant,
            defaults={"ui_theme": "editorial", "media_mode": "video", "published": True},
        )

        self._seed_menu(restaurant)
        self._seed_tables(restaurant)
        self._seed_customer(restaurant)
        self._seed_sample_order(restaurant)

        self.stdout.write(self.style.SUCCESS("Demo seeded."))
        self.stdout.write(f"  restaurant_id : {restaurant.id}")
        self.stdout.write(f"  public menu   : /api/public/menu/{restaurant.id}/")
        self.stdout.write(f"  login         : {DEMO_USERNAME} / {DEMO_PASSWORD}")

    def _seed_menu(self, restaurant: Restaurant) -> None:
        for code, (name, sort, items) in MENU.items():
            category, _ = MenuCategory.all_objects.get_or_create(
                restaurant_id=restaurant.id,
                code=code,
                defaults={"name": name, "sort_order": sort},
            )
            for item_code, item_name, rupees, opts in items:
                MenuItem.all_objects.get_or_create(
                    restaurant_id=restaurant.id,
                    code=item_code,
                    defaults={
                        "category": category,
                        "name": item_name,
                        "price_minor": rupees * 100,
                        "description": opts.get("desc", f"{item_name} — a Relish demo favourite."),
                        "tags": opts.get("tags", []),
                        "is_jain": opts.get("jain", False),
                        "can_be_jain": opts.get("can_be_jain", False),
                        "chefs_special": opts.get("chef", False),
                        "spice_level": opts.get("spice", 0),
                        "available": True,
                        "image_url": f"/assets/dishes/{item_code}.webp",
                    },
                )

    def _seed_tables(self, restaurant: Restaurant) -> None:
        for n in range(1, 15):
            RestaurantTable.all_objects.get_or_create(
                restaurant_id=restaurant.id,
                code=f"T{n:02d}",
                defaults={
                    "label": f"Table {n}",
                    "seats": SEATS[n % len(SEATS)],
                    "zone": ZONES[n % len(ZONES)],
                    "status": "available",
                },
            )

    def _seed_customer(self, restaurant: Restaurant) -> None:
        Customer.objects.get_or_create(
            org_id=restaurant.org_id,
            phone="+919876500001",
            defaults={
                "name": "Aanya Sharma",
                "tier": "Gold",
                "points": 1850,
                "visits": 24,
                "lifetime_spend_minor": 4_850_000,
                "tags": ["Regular", "Big spender"],
                "last_visit": timezone.now(),
            },
        )

    def _seed_sample_order(self, restaurant: Restaurant) -> None:
        code = "ORD-DEMO-1"
        if Order.all_objects.filter(restaurant_id=restaurant.id, code=code).exists():
            return
        items = list(
            MenuItem.all_objects.filter(
                restaurant_id=restaurant.id, deleted_at__isnull=True
            ).order_by("code")[:2]
        )
        if not items:
            return
        table = RestaurantTable.all_objects.filter(restaurant_id=restaurant.id).first()
        subtotal = sum(it.price_minor for it in items)
        tax = sum(it.price_minor * it.tax_rate_pct // 100 for it in items)
        served = ORDER_STATUS_CHOICES[-1][0]  # "served"
        order = Order.all_objects.create(
            restaurant_id=restaurant.id,
            code=code,
            table=table,
            source="staff",
            status=served,
            subtotal_minor=subtotal,
            tax_minor=tax,
            total_minor=subtotal + tax,
            paid=True,
        )
        for it in items:
            OrderLine.objects.create(
                restaurant_id=restaurant.id,
                order=order,
                menu_item=it,
                item_name=it.name,
                unit_price_minor=it.price_minor,
                qty=1,
                category_id=it.category_id,
            )
