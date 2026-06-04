import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../i18n'
import * as payments from '../lib/payments'
import type { PaymentGateway } from '../lib/payments'
import { Checkout } from './Checkout'

function renderCheckout() {
  return render(
    <LanguageProvider>
      <Checkout
        open
        items={[]}
        subtotal={1000}
        reference="ref-1"
        onClose={() => {}}
        onPaid={() => {}}
      />
    </LanguageProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Checkout payment error handling (A1 regression)', () => {
  it('routes a failing gateway to a retryable "failed" state instead of a stuck spinner', async () => {
    const gateway: PaymentGateway = {
      id: 'demo',
      label: 'Demo',
      // A conforming gateway never rejects, but a misbehaving/old one might —
      // the UI must not hang on "Processing…" if it does.
      pay: () => Promise.reject(new Error('network down')),
    }
    vi.spyOn(payments, 'getPaymentGateway').mockReturnValue(gateway)

    renderCheckout()
    fireEvent.click(screen.getByRole('button', { name: /^Pay/ }))

    // The (already-rendered) failure message appears…
    expect(
      await screen.findByText('Payment failed. Please try again.'),
    ).toBeInTheDocument()
    // …and we are NOT left stuck on the processing state.
    expect(screen.queryByText('Processing…')).not.toBeInTheDocument()
  })
})
