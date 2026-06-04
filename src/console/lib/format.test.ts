import { describe, expect, it } from 'vitest'
import { formatMoney } from '../../lib/money'
import { inr, inrCompact, pct } from './format'

describe('console money formatting', () => {
  it('inr delegates to the shared formatMoney (one INR formatter, no drift)', () => {
    for (const v of [0, 320, 1200, 12345, 1234567]) {
      expect(inr(v)).toBe(formatMoney(v, 'INR'))
    }
  })

  it('inr renders whole rupees with en-IN (lakh/crore) grouping', () => {
    expect(inr(1200)).toBe('₹1,200')
    expect(inr(1234567)).toBe('₹12,34,567')
  })

  it('inr rounds fractional input like formatMoney', () => {
    expect(inr(1200.4)).toBe(formatMoney(1200.4, 'INR'))
    expect(inr(1200.6)).toBe(formatMoney(1200.6, 'INR'))
  })

  it('inrCompact abbreviates large amounts (k / L)', () => {
    expect(inrCompact(500)).toBe('₹500')
    expect(inrCompact(12400)).toBe('₹12.4k')
    expect(inrCompact(250000)).toBe('₹2.5L')
  })

  it('pct formats signed fractional deltas', () => {
    expect(pct(0.123)).toBe('+12.3%')
    expect(pct(-0.05)).toBe('-5.0%')
  })
})
