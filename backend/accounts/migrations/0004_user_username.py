"""Move auth from email to username (email becomes optional/recovery-only).

Three-step, data-safe:
1. add ``username`` nullable,
2. backfill from each user's email local-part (deduped),
3. tighten ``username`` to unique+non-null and make ``email`` optional.
"""
import re

import django.contrib.auth.validators
from django.db import migrations, models


def _slug_username(value: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_.+-]", "", (value or "").split("@")[0])
    return base or "user"


def backfill_usernames(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seen: set[str] = set()
    for user in User.objects.all().order_by("date_joined"):
        if user.username:
            seen.add(user.username.lower())
            continue
        base = _slug_username(user.email)
        candidate = base
        suffix = 1
        while candidate.lower() in seen:
            suffix += 1
            candidate = f"{base}{suffix}"
        user.username = candidate
        seen.add(candidate.lower())
        user.save(update_fields=["username"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_identity_seed"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(max_length=150, null=True),
        ),
        migrations.RunPython(backfill_usernames, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.",
                max_length=150,
                unique=True,
                validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                verbose_name="username",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                blank=True,
                help_text="Optional. Used for account recovery.",
                max_length=254,
                null=True,
                unique=True,
                verbose_name="email address",
            ),
        ),
        migrations.AlterModelOptions(
            name="user",
            options={
                "ordering": ["username"],
                "verbose_name": "user",
                "verbose_name_plural": "users",
            },
        ),
    ]
