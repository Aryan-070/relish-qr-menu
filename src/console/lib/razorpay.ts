// Browser-side Razorpay Checkout helper.
//
// This module is part of the app `tsc` build, so it must stay strictly valid
// browser TypeScript: no Node APIs, no `any`. The Razorpay script loader and
// the typed `window.Razorpay` accessor live in `lib/payments/razorpayScript.ts`.
// All secret-bearing work happens in the Vercel serverless functions under
// `api/razorpay/`.
//
// It is inert until `VITE_RAZORPAY_KEY_ID` is set — `isRazorpayConfigured`
// gates any UI that would call `startRenewalPayment`.

import {
  getRazorpayConstructor,
  loadRazorpayCheckoutScript,
} from '../../lib/payments/razorpayScript'

/** True only when the publishable Razorpay key is configured at build time. */
export const isRazorpayConfigured: boolean = Boolean(
  import.meta.env.VITE_RAZORPAY_KEY_ID,
)

interface CreateOrderResponse {
  orderId: string
}

interface StartRenewalPaymentOptions {
  amountPaise: number
  invoiceId: string
  description: string
  customerEmail?: string
  onSuccess: () => void | Promise<void>
  onDismiss?: () => void
}

/**
 * Start a subscription-renewal payment:
 *  1. create a Razorpay order via the serverless function,
 *  2. lazy-load the Checkout script,
 *  3. open the Checkout modal and run `onSuccess` once payment completes.
 */
export async function startRenewalPayment(
  opts: StartRenewalPaymentOptions,
): Promise<void> {
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID

  if (!keyId) {
    throw new Error('Razorpay is not configured (VITE_RAZORPAY_KEY_ID missing)')
  }

  const response = await fetch('/api/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountPaise: opts.amountPaise,
      invoiceId: opts.invoiceId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create Razorpay order (${response.status})`)
  }

  const { orderId } = (await response.json()) as CreateOrderResponse

  if (!orderId) {
    throw new Error('Razorpay order response missing orderId')
  }

  await loadRazorpayCheckoutScript()

  const Razorpay = getRazorpayConstructor()
  if (!Razorpay) {
    throw new Error('Razorpay Checkout failed to initialise')
  }

  const checkout = new Razorpay({
    key: keyId,
    order_id: orderId,
    amount: opts.amountPaise,
    currency: 'INR',
    name: 'Relish',
    description: opts.description,
    prefill: opts.customerEmail ? { email: opts.customerEmail } : undefined,
    handler: () => {
      void opts.onSuccess()
    },
    modal: {
      ondismiss: opts.onDismiss,
    },
  })

  checkout.open()
}
