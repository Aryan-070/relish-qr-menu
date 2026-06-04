"""Choice sets and shared constants for the dining-session domain.

Kept in a tiny dependency-free module so models, services, serializers and
migrations can all import the same tuples without circular imports.
"""
from __future__ import annotations

# ── Session lifecycle ────────────────────────────────────────────────────────
SESSION_STATUS_CHOICES = (
    ("open", "Open"),
    ("ordering", "Ordering"),
    ("bill_requested", "Bill requested"),
    ("closed", "Closed"),
    ("abandoned", "Abandoned"),
)
#: Statuses for which a session is still "live" — the partial-unique index that
#: guarantees one live session per table is conditioned on exactly these.
LIVE_SESSION_STATUSES = ("open", "ordering", "bill_requested")

# ── Ordering authority (the configurable gate) ───────────────────────────────
ORDER_CONFIRMATION_MODE_CHOICES = (
    ("auto_fire", "Auto fire"),          # pure QSR: any joined device fires
    ("leader", "Leader"),                # only the waiter-anointed leader orders
    ("waiter_confirm", "Waiter confirm"),  # anyone carts; waiter fires a batch
)
#: Robust default — bill integrity without putting the waiter on the critical
#: path of every order (LLM-council recommendation).
DEFAULT_ORDER_CONFIRMATION_MODE = "waiter_confirm"

# ── Device role within a session ─────────────────────────────────────────────
DEVICE_ROLE_CHOICES = (
    ("participant", "Participant"),  # browse-only
    ("orderer", "Orderer"),          # may submit (granted, non-leader)
    ("leader", "Leader"),            # the single waiter-anointed orderer
)

# ── Check (the money object) ─────────────────────────────────────────────────
CHECK_STATUS_CHOICES = (
    ("open", "Open"),
    ("partially_paid", "Partially paid"),
    ("settled", "Settled"),
    ("void", "Void"),
    ("disputed", "Disputed"),
)
