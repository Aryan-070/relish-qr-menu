"""
Django settings for the Relish restaurant-OS backend.

Single env-driven settings module (django-environ). Safe local defaults so the
project runs and tests pass with zero configuration:
  - SECRET_KEY defaults to an insecure dev key (override in prod).
  - DATABASE defaults to a local SQLite file (override with DATABASE_URL=postgres://…).
  - CACHE / CHANNEL_LAYERS default to in-memory (override with REDIS_URL).

See docs/ARCHITECTURE/backend.md for the architecture this implements.
"""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["*"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5173", "http://127.0.0.1:5173"]),
    USE_S3=(bool, False),
)

# Load a .env file if present (never committed; see .env.example).
environ.Env.read_env(BASE_DIR / ".env")

# ── Core ────────────────────────────────────────────────────────────────────
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# ── Applications ────────────────────────────────────────────────────────────
# ``daphne`` must precede the contrib apps so ``manage.py runserver`` serves the
# ASGI application (Channels WebSockets), not the WSGI dev server. Production
# runs daphne/uvicorn against ``config.asgi:application`` directly.
DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "channels",
]
# Local apps — each is a self-contained vertical slice (see backend/<app>/).
LOCAL_APPS = [
    "common",
    "accounts",
    "billing",
    "menu",
    "theming",
    "ops",
    "dining",
    "crm",
    "inventory",
    "assets",
    "public",
    "realtime",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware ──────────────────────────────────────────────────────────────
MIDDLEWARE = [
    # First, so every log line and response carries a request id.
    "common.request_id.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Resolves the active tenant from the JWT and binds it to the request +
    # a Postgres session GUC (RLS backstop). Defined in common/middleware.py.
    "common.middleware.TenantMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── Database ────────────────────────────────────────────────────────────────
# Defaults to SQLite so tests/dev run with no Postgres. Prod/Docker set
# DATABASE_URL=postgres://… (region ap-south-1). The TenantShard router (Phase 6)
# adds dedicated connections for promoted tenants.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    ),
}
DATABASES["default"].setdefault("ATOMIC_REQUESTS", False)

# Routes a promoted tenant's data-plane queries to its dedicated DB connection
# (per TenantShard.connection_alias). Inert while only "default" exists — it
# never queries the DB in the hot path and returns None (default routing) until
# extra connections are configured (Phase 7). See common/routers.py.
DATABASE_ROUTERS = ["common.routers.TenantShardRouter"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# ── Password validation ─────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── I18N / TZ ───────────────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = env("DJANGO_TIME_ZONE", default="Asia/Kolkata")
USE_I18N = True
USE_TZ = True

# ── Static / media ──────────────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if env("USE_S3"):
    # S3 / Cloudflare R2 via django-storages (Phase 4).
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("AWS_STORAGE_BUCKET_NAME", default=""),
            "endpoint_url": env("AWS_S3_ENDPOINT_URL", default=None),
            "region_name": env("AWS_S3_REGION_NAME", default="ap-south-1"),
        },
    }

# ── Media uploads (Phase 4: presigned S3/R2 + transcode) ────────────────────
ASSET_BUCKET = env("AWS_STORAGE_BUCKET_NAME", default="relish-media")
ASSET_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
ASSET_S3_REGION = env("AWS_S3_REGION_NAME", default="ap-south-1")
ASSET_PUBLIC_BASE_URL = env("ASSET_PUBLIC_BASE_URL", default="")  # CDN base, optional
ASSET_IMAGE_MAX_BYTES = env.int("ASSET_IMAGE_MAX_BYTES", default=8_000_000)  # 8 MB
ASSET_VIDEO_MAX_BYTES = env.int("ASSET_VIDEO_MAX_BYTES", default=200_000_000)  # 200 MB
ASSET_TENANT_QUOTA_BYTES = env.int(
    "ASSET_TENANT_QUOTA_BYTES", default=5_000_000_000
)  # 5 GB per restaurant
ASSET_ALLOWED_IMAGE_TYPES = env.list(
    "ASSET_ALLOWED_IMAGE_TYPES",
    default=["image/jpeg", "image/png", "image/webp", "image/avif"],
)
ASSET_ALLOWED_VIDEO_TYPES = env.list(
    "ASSET_ALLOWED_VIDEO_TYPES", default=["video/mp4", "video/webm", "video/quicktime"]
)
ASSET_VIDEO_RENDITION_HEIGHTS = [1080, 720, 360]
# When False (e.g. no Celery worker), video uploads are served as the uploaded
# original (status 'ready') instead of being queued for ffmpeg transcoding.
MEDIA_TRANSCODE_ENABLED = env.bool("MEDIA_TRANSCODE_ENABLED", default=True)

# Secret that enables POST /api/admin/seed-demo/ (one-time demo seed on hosts
# with no shell). Unset = endpoint returns 404.
SEED_TOKEN = env("SEED_TOKEN", default="")

# ── DRF ─────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "1000/min",
        "public_menu": "120/min",
        "razorpay_order": "30/min",
        "dining_join": "60/min",
        "dining_pay": "6/min",
    },
    "EXCEPTION_HANDLER": "common.exceptions.custom_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    # Custom claims (active membership / restaurant / org) are injected by
    # accounts' token serializer and read by common.middleware (Phase 1).
}

# Schema + Swagger UI are gated behind admin auth in production unless
# SCHEMA_PUBLIC=true; always open in DEBUG for local dev.
SCHEMA_PUBLIC = env.bool("SCHEMA_PUBLIC", default=False)
_SCHEMA_SERVE_PERMISSIONS = (
    ["rest_framework.permissions.AllowAny"]
    if (DEBUG or SCHEMA_PUBLIC)
    else ["rest_framework.permissions.IsAdminUser"]
)

SPECTACULAR_SETTINGS = {
    "TITLE": "Relish Restaurant-OS API",
    "DESCRIPTION": "Multi-tenant restaurant operating system. See docs/ARCHITECTURE/backend.md.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SERVE_PERMISSIONS": _SCHEMA_SERVE_PERMISSIONS,
    # Keep the default enum hook; add our global error-envelope documentation.
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "common.schema.error_envelope_postprocessing_hook",
    ],
    # The permission-keys choice set appears as both `add` and `revoke`
    # (SetPermissionsSerializer) — name it once to avoid a collision warning.
    "ENUM_NAME_OVERRIDES": {
        "PermissionKeyEnum": "accounts.constants.PERMISSION_KEYS",
    },
}

# ── CORS ────────────────────────────────────────────────────────────────────
from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
# Guest dining traffic sends an opaque device token + an order idempotency key;
# both are custom headers and must be allowlisted for the browser preflight to
# pass (otherwise the cross-origin GET/POST is silently cancelled after OPTIONS).
CORS_ALLOW_HEADERS = (*default_headers, "x-device-token", "idempotency-key")

# ── Cache / Channels (Redis when REDIS_URL set, else in-memory) ─────────────
REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# ── Celery ──────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL or "memory://")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=REDIS_URL or "cache+memory://")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=not bool(REDIS_URL))
CELERY_TASK_TIME_LIMIT = 600
CELERY_TIMEZONE = TIME_ZONE

# ── Razorpay (server-side only — never exposed to the client bundle) ────────
RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", default="")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", default="")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", default="")

# ── Sentry (optional error reporting — no-op when SENTRY_DSN is unset) ───────
SENTRY_DSN = env("SENTRY_DSN", default="")
SENTRY_TRACES_SAMPLE_RATE = env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0)
SENTRY_ENV = env("SENTRY_ENV", default="development" if DEBUG else "production")

# ── Logging (structured single-line JSON with request-id correlation) ───────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "common.logging.JsonLogFormatter"},
        "verbose": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"},
    },
    "filters": {
        "request_id": {"()": "common.logging.RequestIDLogFilter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
            "filters": ["request_id"],
        },
    },
    "root": {"handlers": ["console"], "level": env("DJANGO_LOG_LEVEL", default="INFO")},
}

# ── Production security ──────────────────────────────────────────────────────
# Enabled by DJANGO_SECURE_SSL=true (set in fly.toml / render.yaml), NOT by
# DEBUG — so the HTTP test client (which runs with DEBUG=False) is never
# redirected to HTTPS. Assumes a TLS-terminating proxy/LB (Fly/Render/Nginx).
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
SECURE_SSL = env.bool("DJANGO_SECURE_SSL", default=False)
if SECURE_SSL:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31_536_000)  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
