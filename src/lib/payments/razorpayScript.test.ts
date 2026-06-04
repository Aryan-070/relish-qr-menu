import { afterEach, describe, expect, it } from 'vitest'
import {
  getRazorpayConstructor,
  loadRazorpayCheckoutScript,
  type RazorpayConstructor,
} from './razorpayScript'

class StubRazorpay {
  open(): void {}
}

afterEach(() => {
  delete window.Razorpay
})

describe('razorpayScript', () => {
  it('getRazorpayConstructor reflects the window global', () => {
    expect(getRazorpayConstructor()).toBeUndefined()
    window.Razorpay = StubRazorpay as unknown as RazorpayConstructor
    expect(getRazorpayConstructor()).toBe(StubRazorpay)
  })

  it('loadRazorpayCheckoutScript resolves immediately when checkout.js is already present', async () => {
    window.Razorpay = StubRazorpay as unknown as RazorpayConstructor
    await expect(loadRazorpayCheckoutScript()).resolves.toBeUndefined()
  })
})
