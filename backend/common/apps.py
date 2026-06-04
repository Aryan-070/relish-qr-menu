from django.apps import AppConfig


class CommonConfig(AppConfig):
    """App config for the ``common`` (multi-tenancy core) slice."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "common"

    def ready(self) -> None:
        # Initialise Sentry once at startup (no-op unless SENTRY_DSN is set).
        from common.observability import init_sentry

        init_sentry()

        # SQLite (dev/test default) serialises writes and, with no busy timeout,
        # raises "database is locked" the instant two requests write at once. A
        # busy_timeout makes a writer wait for the lock instead of erroring, so
        # concurrent enroll/seat calls queue rather than 500. (We deliberately
        # stay in the default rollback-journal mode — WAL's snapshot isolation
        # would let two writers both read a stale `version` and defeat the
        # compare-and-swap optimistic lock in ops.floor_views.) No-op on Postgres.
        from django.db.backends.signals import connection_created
        from django.dispatch import receiver

        @receiver(connection_created)
        def _tune_sqlite(sender, connection, **kwargs):  # noqa: ANN001, ANN202
            if connection.vendor != "sqlite":
                return
            connection.cursor().execute("PRAGMA busy_timeout=5000;")
