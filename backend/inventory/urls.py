"""Inventory & procurement API routes (mounted under ``/api/inventory/``)."""
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from inventory.views import (
    IngredientViewSet,
    PromoViewSet,
    PurchaseOrderViewSet,
    RecipeViewSet,
    StockMovementViewSet,
    SupplierViewSet,
    WastageViewSet,
)

app_name = "inventory"

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("ingredients", IngredientViewSet, basename="ingredient")
router.register("recipes", RecipeViewSet, basename="recipe")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("wastage", WastageViewSet, basename="wastage")
router.register("promos", PromoViewSet, basename="promo")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = router.urls
