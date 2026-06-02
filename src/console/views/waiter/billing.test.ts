import { describe, it, expect } from 'vitest'
import { computeTotals, withTip } from './billing'

describe('computeTotals', () => {
  it('adds 5% service charge and 5% GST on top with no discount', () => {
    const t = computeTotals(1000, 0)
    expect(t.subtotal).toBe(1000)
    expect(t.discountAmount).toBe(0)
    expect(t.serviceCharge).toBe(50)
    expect(t.tax).toBe(50)
    expect(t.total).toBe(1100)
  })

  it('applies a discount before service charge and tax', () => {
    const t = computeTotals(1000, 10)
    expect(t.discountAmount).toBe(100)
    // taxable = 900; service = 45; tax = 45; total = 990
    expect(t.serviceCharge).toBe(45)
    expect(t.tax).toBe(45)
    expect(t.total).toBe(990)
  })

  it('clamps the discount percentage to the 0..50 range', () => {
    const high = computeTotals(1000, 80)
    expect(high.discountAmount).toBe(500) // clamped to 50%
    const low = computeTotals(1000, -10)
    expect(low.discountAmount).toBe(0) // clamped to 0%
  })

  it('rounds charges to whole rupees', () => {
    const t = computeTotals(333, 0)
    // service = round(16.65) = 17; tax = 17; total = 333 + 17 + 17
    expect(t.serviceCharge).toBe(17)
    expect(t.tax).toBe(17)
    expect(t.total).toBe(367)
  })

  it('keeps the total integral (no fractional rupees)', () => {
    const t = computeTotals(777, 13)
    expect(Number.isInteger(t.total)).toBe(true)
    expect(Number.isInteger(t.serviceCharge)).toBe(true)
    expect(Number.isInteger(t.tax)).toBe(true)
  })
})

describe('withTip', () => {
  it('adds a positive tip on top of the computed total', () => {
    const totals = computeTotals(1000, 0)
    const r = withTip(totals, 100)
    expect(r.tip).toBe(100)
    expect(r.grandTotal).toBe(totals.total + 100)
  })

  it('clamps a negative tip to zero', () => {
    const totals = computeTotals(1000, 0)
    const r = withTip(totals, -50)
    expect(r.tip).toBe(0)
    expect(r.grandTotal).toBe(totals.total)
  })
})
