"""Optional error reporting via Sentry.

:func:`init_sentry` initialises the Sentry SDK iff a ``SENTRY_DSN`` is
configured *and* ``sentry-sdk`` is installed. Both are optional in dev and CI:
the dependency is imported lazily and a missing package or empty DSN is a
graceful no-op (returns ``False``), so importing or calling this module never
breaks an environment that hasn't opted into Sentry.

Call it once at startup (e.g. from ``settings`` or an ``AppConfig.ready``), the
orchestrator wires the exact call site::

    from common.observability import init_sentry
    init_sentry()
"""
from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """Initialise Sentry if a DSN is set and the SDK is importable.

    Returns ``True`` when ``sentry_sdk.init`` was called, ``False`` otherwise
    (no DSN, SDK missing, or an init error). Never raises.
    """
    dsn = getattr(settings, "SENTRY_DSN", "")
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
    except ImportError:
        logger.warning(
            "SENTRY_DSN is set but 'sentry-sdk' is not installed; "
            "error reporting is disabled. Install sentry-sdk to enable it."
        )
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            integrations=[DjangoIntegration()],
            traces_sample_rate=getattr(settings, "SENTRY_TRACES_SAMPLE_RATE", 0.0),
            environment=getattr(settings, "SENTRY_ENV", "production"),
            send_default_pii=False,
        )
    except Exception:  # noqa: BLE001 - observability must never break startup.
        logger.exception("Failed to initialise Sentry; error reporting disabled.")
        return False

    return True
