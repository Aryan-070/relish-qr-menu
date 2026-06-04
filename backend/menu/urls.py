"""Menu console API routes (mounted under ``/api/menu/`` by ``config.urls``)."""
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from menu.views import (
    MenuCategoryViewSet,
    MenuItemViewSet,
    ModifierGroupViewSet,
    ModifierViewSet,
)

app_name = "menu"

router = DefaultRouter()
router.register("categories", MenuCategoryViewSet, basename="category")
router.register("items", MenuItemViewSet, basename="item")
router.register("modifier-groups", ModifierGroupViewSet, basename="modifier-group")
router.register("modifiers", ModifierViewSet, basename="modifier")

urlpatterns = router.urls
