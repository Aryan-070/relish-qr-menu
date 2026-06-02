/**
 * payments — public entry for guest pay-at-table.
 *
 * `getPaymentGateway()` returns the live Razorpay provider when configured,
 * else the keyless demo provider — so checkout code never branches on the
 * environment. Demo mode (the default for the sales asset) always works.
 */

import { isRazorpayConfigured } from '../../console/lib/razorpay'
import { demoGateway } from './demoGateway'
import { razorpayGateway } from './razorpayGateway'
import type { PaymentGateway } from './types'

export type {
  PaymentGateway,
  PaymentRequest,
  PaymentResult,
  PaymentMethodId,
} from './types'

/** Resolve the active payment gateway for the current build. */
export function getPaymentGateway(): PaymentGateway {
  return isRazorpayConfigured ? razorpayGateway : demoGateway
}
