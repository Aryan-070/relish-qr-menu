/**
 * razorpayGateway.ts — live UPI / cards / wallets via Razorpay Checkout.
 *
 * Reuses the existing serverless order-creation endpoint and Checkout-script
 * loader from `console/lib/razorpay.ts` (no backend changes needed): the guest
 * order id rides in as the `invoiceId` / receipt reference. Active only when
 * `VITE_RAZORPAY_KEY_ID` is set; otherwise the factory in `index.ts` falls back
 * to the demo gateway.
 *
 * Conforms to {@link PaymentGateway}: `pay` resolves with an outcome and never
 * rejects — provider/network errors become `status: 'failed'`.
 */

import { startRenewalPayment } from '../../console/lib/razorpay'
import type { PaymentGateway, PaymentRequest, PaymentResult } from './types'

/** Razorpay charges in the minor unit (paise). Convert from whole rupees. */
const PAISE_PER_RUPEE = 100

export const razorpayGateway: PaymentGateway = {
  id: 'razorpay',
  label: 'UPI / Cards / Wallets',
  pay(request: PaymentRequest): Promise<PaymentResult> {
    return new Promise<PaymentResult>(resolve => {
      let settled = false
      const settle = (result: PaymentResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      void startRenewalPayment({
        amountPaise: Math.round(request.amount * PAISE_PER_RUPEE),
        invoiceId: request.reference,
        description: request.description,
        customerEmail: request.customerEmail,
        onSuccess: () =>
          settle({ status: 'paid', method: 'razorpay', reference: request.reference }),
        onDismiss: () =>
          settle({ status: 'dismissed', method: 'razorpay', reference: request.reference }),
      }).catch((error: unknown) =>
        settle({
          status: 'failed',
          method: 'razorpay',
          reference: request.reference,
          error: error instanceof Error ? error.message : 'Payment failed',
        }),
      )
    })
  },
}
