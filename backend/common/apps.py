from django.apps import AppConfig


class CommonConfig(AppConfig):
    """App config for the ``common`` (multi-tenancy core) slice."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "common"
