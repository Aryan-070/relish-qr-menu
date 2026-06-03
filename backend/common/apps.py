from django.apps import AppConfig


class CommonConfig(AppConfig):
    """App config for the ``common`` (multi-tenancy core) slice."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "common"

    def ready(self) -> None:
        # Initialise Sentry once at startup (no-op unless SENTRY_DSN is set).
        from common.observability import init_sentry

        init_sentry()
