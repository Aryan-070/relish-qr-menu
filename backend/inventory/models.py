"""Inventory & procurement domain (all per-outlet / tenant-scoped).

Stock is tracked as a running balance on ``Ingredient.stock`` whose truth is the
append-only ``StockMovement`` ledger (purchase / order-depletion / wastage /
adjust). Recipes are the bill-of-materials linking a menu item to ingredients.
Money is integer minor units (paise); quantities are decimals.
"""
from django.db import models

from common.models import TenantScopedModel

UNIT_CHOICES = (("kg", "kg"), ("L", "L"), ("pcs", "pcs"))
PO_STATUS_CHOICES = (
    ("draft", "Draft"),
    ("ordered", "Ordered"),
    ("received", "Received"),
)
STOCK_REASON_CHOICES = (
    ("order", "Order depletion"),
    ("purchase", "Purchase receipt"),
    ("wastage", "Wastage"),
    ("adjust", "Manual adjustment"),
)
PROMO_KIND_CHOICES = (
    ("percent", "Percent"),
    ("flat", "Flat"),
    ("coupon", "Coupon"),
)


class Supplier(TenantScopedModel):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Ingredient(TenantScopedModel):
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=8, choices=UNIT_CHOICES, default="pcs")
    stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    low_threshold = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    cost_per_unit_minor = models.IntegerField(default=0)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ingredients",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Recipe(TenantScopedModel):
    """Bill of materials for a menu item (one recipe per item)."""

    menu_item = models.OneToOneField(
        "menu.MenuItem", on_delete=models.CASCADE, related_name="recipe"
    )

    def __str__(self) -> str:
        return f"recipe<{self.menu_item_id}>"


class RecipeLine(models.Model):
    id = models.BigAutoField(primary_key=True)
    restaurant_id = models.UUIDField(db_index=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="lines")
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="recipe_lines"
    )
    qty = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recipe", "ingredient"], name="uniq_recipe_ingredient"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.recipe_id}:{self.ingredient_id}"


class PurchaseOrder(TenantScopedModel):
    code = models.CharField(max_length=40)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchase_orders"
    )
    status = models.CharField(
        max_length=10, choices=PO_STATUS_CHOICES, default="draft"
    )
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant_id", "code"], name="uniq_po_restaurant_code"
            ),
        ]

    def __str__(self) -> str:
        return self.code


class PurchaseOrderLine(models.Model):
    id = models.BigAutoField(primary_key=True)
    restaurant_id = models.UUIDField(db_index=True)
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name="lines"
    )
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="po_lines"
    )
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    cost_minor = models.IntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.purchase_order_id}:{self.ingredient_id}"


class Wastage(TenantScopedModel):
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="wastage"
    )
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"wastage<{self.ingredient_id}>"


class StockMovement(TenantScopedModel):
    """Append-only signed stock-delta ledger; truth behind Ingredient.stock."""

    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="movements"
    )
    delta = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=10, choices=STOCK_REASON_CHOICES)
    ref_id = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["restaurant_id", "ingredient", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.ingredient_id}:{self.delta:+}"


class Promo(TenantScopedModel):
    code = models.CharField(max_length=40, blank=True)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=PROMO_KIND_CHOICES)
    value = models.IntegerField(default=0)
    single_use = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    start_hour = models.PositiveSmallIntegerField(null=True, blank=True)
    end_hour = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
