/**
 * Opens Razorpay Checkout for an order that the backend already created
 * (e.g. via the dining `pay` endpoint, which returns the Razorpay order id).
 * Settlement is server-side via the webhook → we only need the modal here.
 *
 * Distinct from src/console/lib/razorpay.ts's `startRenewalPayment`, which
 * creates its own order against the Vercel function — here the order id is
 * passed in so we never double-create. Both share the script loader in
 * `razorpayScript.ts`.
 */
import {
  getRazorpayConstructor,
  loadRazorpayCheckoutScript,
} from './razorpayScript'

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
export const isRazorpayConfigured = Boolean(RAZORPAY_KEY_ID)

export interface OpenCheckoutOptions {
  orderId: string
  amountMinor: number
  currency?: string
  name?: string
  description?: string
  onSuccess?: () => void
  onDismiss?: () => void
}

/** Load Razorpay and open the modal for a pre-created order. Throws if the
 * publishable key is unset (the caller should fall back to pay-at-counter). */
export async function openRazorpayCheckout(opts: OpenCheckoutOptions): Promise<void> {
  if (!RAZORPAY_KEY_ID) throw new Error('Razorpay is not configured.')
  await loadRazorpayCheckoutScript()
  const Razorpay = getRazorpayConstructor()
  if (!Razorpay) throw new Error('Razorpay unavailable.')
  const checkout = new Razorpay({
    key: RAZORPAY_KEY_ID,
    order_id: opts.orderId,
    amount: opts.amountMinor,
    currency: opts.currency ?? 'INR',
    name: opts.name ?? 'The Table Theory',
    description: opts.description ?? 'Table bill',
    handler: () => opts.onSuccess?.(),
    modal: { ondismiss: () => opts.onDismiss?.() },
  })
  checkout.open()
}
