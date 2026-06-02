import { describe, it, expect } from 'vitest'
import {
  splitEvenly,
  splitByItems,
  splitByGuests,
  distributeRoundingResidual,
  type SplitShare,
  type SplitLine,
} from './split'

const sum = (shares: readonly SplitShare[]): number =>
  shares.reduce((acc, s) => acc + s.amount, 0)

describe('splitEvenly', () => {
  it('distributes the rounding residual so shares sum exactly to total', () => {
    const result = splitEvenly(100, 3)
    expect(result.shares.map((s) => s.amount)).toEqual([34, 33, 33])
    expect(sum(result.shares)).toBe(100)
    expect(result.remainder).toBe(0)
    expect(result.overage).toBe(0)
    expect(result.collected).toBe(100)
  })

  it('splits cleanly with no residual when divisible', () => {
    const result = splitEvenly(900, 6)
    expect(result.shares).toHaveLength(6)
    expect(result.shares.every((s) => s.amount === 150)).toBe(true)
    expect(sum(result.shares)).toBe(900)
    expect(result.remainder).toBe(0)
  })

  it('preserves the exact-sum invariant across many people', () => {
    const result = splitEvenly(1001, 7)
    expect(sum(result.shares)).toBe(1001)
    expect(result.remainder).toBe(0)
    // residual of 1001 % 7 = 0 -> all equal
    expect(result.shares.every((s) => s.amount === 143)).toBe(true)
  })

  it('hands the residual to the leading shares', () => {
    const result = splitEvenly(10, 4) // base 2, residual 2
    expect(result.shares.map((s) => s.amount)).toEqual([3, 3, 2, 2])
    expect(sum(result.shares)).toBe(10)
  })

  it('falls back to a single share when there are no people', () => {
    const result = splitEvenly(500, 0)
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].amount).toBe(500)
    expect(result.remainder).toBe(0)
  })

  it('produces all-zero shares for a zero total', () => {
    const result = splitEvenly(0, 3)
    expect(sum(result.shares)).toBe(0)
    expect(result.shares.every((s) => s.amount === 0)).toBe(true)
  })

  it('rounds each share up to roundTo and reports the overage', () => {
    const result = splitEvenly(100, 3, { roundTo: 10 })
    expect(result.shares.every((s) => s.amount === 40)).toBe(true)
    expect(result.collected).toBe(120)
    expect(result.overage).toBe(20)
    expect(result.remainder).toBe(0)
  })
})

describe('distributeRoundingResidual', () => {
  it('adds a positive residual to the leading shares', () => {
    const seeded: SplitShare[] = [
      { id: 'a', label: 'A', amount: 33 },
      { id: 'b', label: 'B', amount: 33 },
      { id: 'c', label: 'C', amount: 33 },
    ]
    const balanced = distributeRoundingResidual(seeded, 100)
    expect(balanced.map((s) => s.amount)).toEqual([34, 33, 33])
    expect(sum(balanced)).toBe(100)
  })

  it('trims a negative residual from the leading shares', () => {
    const seeded: SplitShare[] = [
      { id: 'a', label: 'A', amount: 34 },
      { id: 'b', label: 'B', amount: 34 },
    ]
    const balanced = distributeRoundingResidual(seeded, 67)
    expect(sum(balanced)).toBe(67)
  })

  it('returns an empty array unchanged', () => {
    expect(distributeRoundingResidual([], 100)).toEqual([])
  })

  it('does not mutate the input shares', () => {
    const seeded: SplitShare[] = [{ id: 'a', label: 'A', amount: 33 }]
    distributeRoundingResidual(seeded, 100)
    expect(seeded[0].amount).toBe(33)
  })
})

describe('splitByItems', () => {
  it('splits shared lines and sums exactly to the grand total', () => {
    const lines: SplitLine[] = [
      { id: 'l1', name: 'Dal', amount: 200, qty: 1 },
      { id: 'l2', name: 'Naan', amount: 120, qty: 1 },
      { id: 'l3', name: 'Starter', amount: 101, qty: 1 },
    ]
    const result = splitByItems(lines, {
      l1: ['a'],
      l2: ['b'],
      l3: ['a', 'b'],
    })
    expect(sum(result.shares)).toBe(421)
    expect(result.remainder).toBe(0)
    const byId = new Map(result.shares.map((s) => [s.id, s.amount]))
    expect(byId.get('a')).toBe(251)
    expect(byId.get('b')).toBe(170)
  })

  it('pools unassigned lines across all participants', () => {
    const lines: SplitLine[] = [
      { id: 'l1', name: 'Pizza', amount: 300, qty: 1 },
      { id: 'l2', name: 'Drinks', amount: 100, qty: 1 },
    ]
    // l2 has no assignment -> pooled across everyone seen (a, b)
    const result = splitByItems(lines, { l1: ['a', 'b'] })
    expect(sum(result.shares)).toBe(400)
    expect(result.remainder).toBe(0)
  })

  it('falls back to a single pooled share when no participants exist', () => {
    const lines: SplitLine[] = [{ id: 'l1', name: 'X', amount: 250, qty: 1 }]
    const result = splitByItems(lines, {})
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].id).toBe('pool')
    expect(result.shares[0].amount).toBe(250)
  })
})

describe('splitByGuests', () => {
  it('sums each guest subtotal into the total', () => {
    const result = splitByGuests([
      { id: 'g1', label: 'Aanya', amount: 420 },
      { id: 'g2', label: 'Rohan', amount: 380 },
    ])
    expect(result.total).toBe(800)
    expect(sum(result.shares)).toBe(800)
    expect(result.remainder).toBe(0)
  })

  it('handles an empty guest list', () => {
    const result = splitByGuests([])
    expect(result.shares).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
