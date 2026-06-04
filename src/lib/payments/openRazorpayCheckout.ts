/**
 * Opens Razorpay Checkout for an order that the backend already created
 * (e.g. via the dining `pay` endpoint, which returns the Razorpay order id).
 * Settlement is server-side via the webhook → we only need the modal here.
 *
 * Distinct from src/console/lib/razorpay.ts's `startRenewalPayment`, which
 * creates its own order against the Vercel function — here the order id is
 * passed in so we never double-create.
 */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

interface RazorpayInstance {
  open: () => void
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance

function getRazorpay(): RazorpayConstructor | undefined {
  return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
export const isRazorpayConfigured = Boolean(RAZORPAY_KEY_ID)

let scriptPromise: Promise<void> | null = null

function loadCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (getRazorpay()) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Razorpay failed to load')))
      return
    }
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Razorpay failed to load'))
    document.body.appendChild(script)
  })
  return scriptPromise
}

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
  await loadCheckoutScript()
  const Razorpay = getRazorpay()
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
