// Browser-side Razorpay Checkout helper.
//
// This module is part of the app `tsc` build, so it must stay strictly valid
// browser TypeScript: no Node APIs, no `any` (except the unavoidable Window
// global below). All secret-bearing work happens in the Vercel serverless
// functions under `api/razorpay/`.
//
// It is inert until `VITE_RAZORPAY_KEY_ID` is set — `isRazorpayConfigured`
// gates any UI that would call `startRenewalPayment`.

declare global {
  interface Window {
    Razorpay?: new (opts: unknown) => { open: () => void }
  }
}

/** True only when the publishable Razorpay key is configured at build time. */
export const isRazorpayConfigured: boolean = Boolean(
  import.meta.env.VITE_RAZORPAY_KEY_ID,
)

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

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

let checkoutScriptPromise: Promise<void> | null = null

/** Inject the Razorpay Checkout <script> once and resolve when it has loaded. */
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve()
  }

  if (checkoutScriptPromise) {
    return checkoutScriptPromise
  }

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    )

    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay Checkout script')),
      )
      return
    }

    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      checkoutScriptPromise = null
      reject(new Error('Failed to load Razorpay Checkout script'))
    })
    document.body.appendChild(script)
  })

  return checkoutScriptPromise
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

  await loadCheckoutScript()

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout failed to initialise')
  }

  const checkout = new window.Razorpay({
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
