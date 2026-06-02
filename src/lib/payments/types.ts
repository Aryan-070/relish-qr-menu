/**
 * payments/types.ts — gateway-agnostic payment contracts for guest pay-at-table.
 *
 * The app talks to a single {@link PaymentGateway} interface; the concrete
 * implementation is chosen at runtime (see {@link module:payments}). This keeps
 * the checkout UI free of any provider specifics so Razorpay (India / UPI) and a
 * keyless demo adapter — and later Stripe for global tenants — are drop-in
 * interchangeable. No React, no I/O here: pure types.
 */

import type { CurrencyCode } from '../money'

/** Which concrete provider handled (or will handle) a payment. */
export type PaymentMethodId = 'demo' | 'razorpay'

/** A request to collect a single payment from a guest. */
export interface PaymentRequest {
  /** Amount in major units (e.g. `1050` means ₹1,050), matching {@link module:money}. */
  amount: number
  /** Currency the amount is denominated in. */
  currency: CurrencyCode
  /** Caller reference (e.g. the order id) echoed back in the result. */
  reference: string
  /** Human-readable description shown in the provider's checkout UI. */
  description: string
  /** Optional guest email to prefill in the provider's checkout. */
  customerEmail?: string
}

/** Outcome of a payment attempt. */
export interface PaymentResult {
  /** `paid` on success; `dismissed` if the guest closed the sheet; `failed` on error. */
  status: 'paid' | 'dismissed' | 'failed'
  /** Which provider produced this result. */
  method: PaymentMethodId
  /** Echo of {@link PaymentRequest.reference}. */
  reference: string
  /** Provider error message when `status === 'failed'`. */
  error?: string
}

/**
 * A pluggable payment provider. Implementations must never throw from `pay` —
 * any failure resolves to a `PaymentResult` with `status: 'failed'` so the UI
 * has a single, total code path.
 */
export interface PaymentGateway {
  /** Stable provider id. */
  readonly id: PaymentMethodId
  /** Short label for UI (e.g. "UPI / Cards" or "Demo pay"). */
  readonly label: string
  /** Collect a payment. Resolves with the outcome; never rejects. */
  pay(request: PaymentRequest): Promise<PaymentResult>
}
