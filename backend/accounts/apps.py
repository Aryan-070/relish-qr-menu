from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """App config for the accounts (identity / auth) slice."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
