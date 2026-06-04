from django.apps import AppConfig


class BillingConfig(AppConfig):
    """App config for the ``billing`` (payments control plane) slice."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "billing"
