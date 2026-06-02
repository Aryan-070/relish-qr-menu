import { describe, it, expect } from 'vitest'
import { isPromoActive, applyPromo } from './promos'
import type { Promo, PromoKind } from '../console/lib/types'

function makePromo(overrides: Partial<Promo> = {}): Promo {
  return {
    id: 'p1',
    name: 'Test Promo',
    kind: 'percent' as PromoKind,
    value: 10,
    active: true,
    createdAt: 0,
    ...overrides,
  }
}

describe('isPromoActive', () => {
  it('is false when the promo is inactive', () => {
    expect(isPromoActive(makePromo({ active: false }), 12)).toBe(false)
  })

  it('is true with no window defined (always-on)', () => {
    expect(isPromoActive(makePromo(), 3)).toBe(true)
  })

  it('honours a same-day happy-hour window (inclusive start, exclusive end)', () => {
    const p = makePromo({ startHour: 14, endHour: 17 })
    expect(isPromoActive(p, 14)).toBe(true)
    expect(isPromoActive(p, 16)).toBe(true)
    expect(isPromoActive(p, 17)).toBe(false)
    expect(isPromoActive(p, 13)).toBe(false)
  })

  it('handles a wrap-around window (22 -> 2)', () => {
    const p = makePromo({ startHour: 22, endHour: 2 })
    expect(isPromoActive(p, 23)).toBe(true)
    expect(isPromoActive(p, 0)).toBe(true)
    expect(isPromoActive(p, 1)).toBe(true)
    expect(isPromoActive(p, 2)).toBe(false)
    expect(isPromoActive(p, 12)).toBe(false)
  })

  it('treats a start === end window as all-day', () => {
    const p = makePromo({ startHour: 9, endHour: 9 })
    expect(isPromoActive(p, 3)).toBe(true)
    expect(isPromoActive(p, 9)).toBe(true)
  })
})

describe('applyPromo', () => {
  it('applies a percent discount floored to whole rupees', () => {
    expect(applyPromo(1000, makePromo({ kind: 'percent', value: 10 }), 12)).toBe(100)
    expect(applyPromo(333, makePromo({ kind: 'percent', value: 10 }), 12)).toBe(33)
  })

  it('clamps percent values above 100', () => {
    expect(applyPromo(1000, makePromo({ kind: 'percent', value: 150 }), 12)).toBe(1000)
  })

  it('applies a flat discount', () => {
    expect(applyPromo(1000, makePromo({ kind: 'flat', value: 200 }), 12)).toBe(200)
  })

  it('applies a coupon discount', () => {
    expect(applyPromo(1000, makePromo({ kind: 'coupon', value: 150 }), 12)).toBe(150)
  })

  it('never lets the discount exceed the subtotal', () => {
    expect(applyPromo(100, makePromo({ kind: 'flat', value: 500 }), 12)).toBe(100)
  })

  it('returns 0 for an inactive or out-of-window promo', () => {
    expect(applyPromo(1000, makePromo({ active: false }), 12)).toBe(0)
    expect(
      applyPromo(1000, makePromo({ startHour: 14, endHour: 17 }), 20),
    ).toBe(0)
  })

  it('returns 0 for a non-positive subtotal', () => {
    expect(applyPromo(0, makePromo({ kind: 'flat', value: 100 }), 12)).toBe(0)
    expect(applyPromo(-50, makePromo({ kind: 'flat', value: 100 }), 12)).toBe(0)
  })
})
