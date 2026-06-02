import { describe, it, expect } from 'vitest'
import {
  computeBillTax,
  splitGst,
  DEFAULT_TAX_CONFIG,
  type TaxComponent,
} from './tax'

const sumComponents = (components: readonly TaxComponent[]): number =>
  components.reduce((acc, c) => acc + c.amount, 0)

describe('computeBillTax (exclusive 5% GST)', () => {
  it('adds 5% GST on top of a ₹1,000 intra-state bill', () => {
    const b = computeBillTax(1000)
    expect(b.taxableBase).toBe(1000)
    expect(b.taxTotal).toBe(50)
    expect(b.grandTotal).toBe(1050)
    expect(b.pricesIncludeTax).toBe(false)
  })

  it('splits the GST into CGST + SGST that sum to the tax total', () => {
    const b = computeBillTax(1000)
    expect(b.components).toHaveLength(2)
    expect(b.components.map((c) => c.label)).toEqual(['CGST', 'SGST'])
    expect(b.components.every((c) => c.pct === 2.5)).toBe(true)
    expect(sumComponents(b.components)).toBe(b.taxTotal)
  })

  it('extracts tax from an inclusive 18% price', () => {
    const b = computeBillTax(118, {
      ...DEFAULT_TAX_CONFIG,
      defaultRatePct: 18,
      pricesIncludeTax: true,
    })
    expect(b.taxableBase).toBe(100)
    expect(b.taxTotal).toBe(18)
    expect(b.grandTotal).toBe(118)
    expect(b.pricesIncludeTax).toBe(true)
  })

  it('charges no tax for a regime: none venue', () => {
    const b = computeBillTax(1000, { ...DEFAULT_TAX_CONFIG, regime: 'none' })
    expect(b.taxTotal).toBe(0)
    expect(b.grandTotal).toBe(1000)
    expect(b.components).toHaveLength(0)
  })

  it('honours a rate override', () => {
    const b = computeBillTax(1000, DEFAULT_TAX_CONFIG, 18)
    expect(b.taxTotal).toBe(180)
    expect(b.grandTotal).toBe(1180)
  })

  it('guards invalid subtotals to zero', () => {
    const b = computeBillTax(-500)
    expect(b.taxableBase).toBe(0)
    expect(b.taxTotal).toBe(0)
    expect(b.grandTotal).toBe(0)
  })
})

describe('splitGst', () => {
  it('splits intra-state tax into equal CGST + SGST halves', () => {
    const components = splitGst(50, 5, false)
    expect(components.map((c) => c.label)).toEqual(['CGST', 'SGST'])
    expect(sumComponents(components)).toBe(50)
    expect(components.every((c) => c.pct === 2.5)).toBe(true)
  })

  it('reconciles an odd tax amount so halves still sum exactly', () => {
    const components = splitGst(25, 5, false)
    expect(sumComponents(components)).toBe(25)
    expect(components).toHaveLength(2)
  })

  it('produces a single IGST line inter-state', () => {
    const components = splitGst(90, 18, true)
    expect(components).toHaveLength(1)
    expect(components[0].label).toBe('IGST')
    expect(components[0].amount).toBe(90)
    expect(components[0].pct).toBe(18)
  })

  it('returns no components for a zero tax amount or zero rate', () => {
    expect(splitGst(0, 5, false)).toHaveLength(0)
    expect(splitGst(50, 0, false)).toHaveLength(0)
  })
})
