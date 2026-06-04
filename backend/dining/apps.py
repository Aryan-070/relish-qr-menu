from django.apps import AppConfig


class DiningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dining"
    verbose_name = "Dining sessions"

    def ready(self) -> None:
        # Connect the payment-settlement receiver (dining → billing signal).
        from . import signals  # noqa: F401
