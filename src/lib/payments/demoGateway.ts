/**
 * demoGateway.ts — keyless payment provider for demo / sales-asset mode.
 *
 * Simulates a successful charge after a short delay so the full pay-at-table
 * flow (checkout → paid → receipt → feedback) works on the live demo with no
 * Razorpay/Stripe keys configured. Never touches the network.
 */

import type { PaymentGateway, PaymentRequest, PaymentResult } from './types'

/** Simulated round-trip latency so the "processing" state is visible. */
const SIMULATED_LATENCY_MS = 900

export const demoGateway: PaymentGateway = {
  id: 'demo',
  label: 'Demo pay',
  pay(request: PaymentRequest): Promise<PaymentResult> {
    return new Promise<PaymentResult>(resolve => {
      window.setTimeout(() => {
        resolve({ status: 'paid', method: 'demo', reference: request.reference })
      }, SIMULATED_LATENCY_MS)
    })
  },
}
