/**
 * Shared Razorpay Checkout <script> loader.
 *
 * Both Razorpay entry points need the same `checkout.js` present, loaded once:
 *  - `openRazorpayCheckout` opens a modal for an order the backend already
 *    created (guest dining `pay` flow), and
 *  - `startRenewalPayment` creates its own order, then opens the modal
 *    (subscription renewals).
 *
 * The loader, the global `window.Razorpay` accessor, and its type previously
 * existed as two near-identical copies. They live here now so there is one
 * script tag, one promise cache, and one error model.
 */

export interface RazorpayInstance {
  open: () => void
}

export type RazorpayConstructor = new (
  options: Record<string, unknown>,
) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/** The global Razorpay constructor, if `checkout.js` has loaded. */
export function getRazorpayConstructor(): RazorpayConstructor | undefined {
  return typeof window === 'undefined' ? undefined : window.Razorpay
}

let scriptPromise: Promise<void> | null = null

/**
 * Inject `checkout.js` once and resolve when it has loaded. Rejects (and clears
 * the cache so a later attempt can retry) if the script fails to load.
 */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay requires a browser environment.'))
  }
  if (getRazorpayConstructor()) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const fail = () => {
      // Allow a later attempt to retry after a transient load failure.
      scriptPromise = null
      reject(new Error('Failed to load Razorpay Checkout script.'))
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', fail)
      return
    }
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', fail)
    document.body.appendChild(script)
  })
  return scriptPromise
}
