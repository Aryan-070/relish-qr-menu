"""The ``billing`` app: the payments / subscription control plane for Relish.

This slice owns subscriptions, invoices, and the Razorpay integration. It is the
security-critical seam of the backend, so three invariants are enforced here and
covered by tests:

1. Webhook signatures are verified in **constant time** over the exact raw
   request body (:func:`billing.services.verify_webhook_signature`).
2. Webhook effects are **idempotent** — a :class:`billing.models.PaymentEvent`
   ledger guarantees an invoice is marked paid exactly once even under Razorpay
   retries (:func:`billing.services.record_and_apply_event`).
3. Order creation is **ownership-checked** and the charge amount is derived
   server-side from the invoice, never trusted from the client
   (:class:`billing.views.CreateOrderView`).

Models are keyed by ``org_id`` (a plain :class:`~django.db.models.UUIDField`)
rather than scoped through ``TenantScopedModel`` because billing is the shared
control plane: it must read/write across tenants from webhook handlers that run
without a bound tenant context.
"""
