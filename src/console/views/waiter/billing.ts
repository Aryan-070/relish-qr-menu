// Pure billing helpers for the multi-desk Billing view.
// No React, no store — easy to reason about and trivially testable.

import type { OrderRecord } from '../../lib/types'

/** Service charge and tax rates applied on top of the (post-discount) subtotal. */
export const SERVICE_CHARGE_RATE = 0.05
export const TAX_RATE = 0.05

export interface ConsolidatedLine {
  itemId: string
  name: string
  price: number
  qty: number
}

export interface ComputedTotals {
  subtotal: number
  discountAmount: number
  serviceCharge: number
  tax: number
  total: number
}

/**
 * Flatten every order line across the supplied orders and merge duplicate items
 * (same itemId) by summing quantities. Insertion order is preserved so the bill
 * reads predictably. Callers pass only the unpaid orders for the selected desks.
 */
export function consolidateLines(orders: OrderRecord[]): ConsolidatedLine[] {
  const byItem = new Map<string, ConsolidatedLine>()
  for (const order of orders) {
    for (const line of order.lines) {
      const existing = byItem.get(line.itemId)
      if (existing) {
        byItem.set(line.itemId, { ...existing, qty: existing.qty + line.qty })
      } else {
        byItem.set(line.itemId, {
          itemId: line.itemId,
          name: line.name,
          price: line.price,
          qty: line.qty,
        })
      }
    }
  }
  return [...byItem.values()]
}

/**
 * Given a pre-tax subtotal and a discount percentage (0–50), derive the
 * discount, 5% service charge, 5% GST and grand total. Service charge and tax
 * are both computed on the discounted subtotal.
 */
export function computeTotals(subtotal: number, discountPct: number): ComputedTotals {
  const safePct = Math.min(50, Math.max(0, discountPct))
  // Whole-rupee rounding throughout — prices/display are in whole ₹, so keeping
  // the math integral avoids fractional-rupee receipts, CSV, and per-head splits.
  const discountAmount = Math.round(subtotal * (safePct / 100))
  const taxable = subtotal - discountAmount
  const serviceCharge = Math.round(taxable * SERVICE_CHARGE_RATE)
  const tax = Math.round(taxable * TAX_RATE)
  const total = taxable + serviceCharge + tax
  return { subtotal, discountAmount, serviceCharge, tax, total }
}

/**
 * Deterministic, human-readable bill number: `RLB-YYYYMMDD-####`.
 * The date is derived from the supplied timestamp (the view passes a stable
 * value — never `Date.now()` at module scope) and `seq` is zero-padded to 4
 * digits. Sequence values are wrapped to 4 digits so the format stays fixed.
 */
export function billNumber(ts: number, seq: number): string {
  const d = new Date(ts)
  const yyyy = d.getFullYear().toString().padStart(4, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const safeSeq = Math.abs(Math.trunc(seq)) % 10_000
  const seqStr = safeSeq.toString().padStart(4, '0')
  return `RLB-${yyyy}${mm}${dd}-${seqStr}`
}

/**
 * Apply a tip on top of the computed (post-tax) total. The tip is clamped to a
 * non-negative integer-friendly value; `computeTotals` stays pure and unaware
 * of tips. Returns the sanitised tip and the resulting grand total.
 */
export function withTip(totals: ComputedTotals, tip: number): { grandTotal: number; tip: number } {
  const safeTip = Math.max(0, tip)
  return { grandTotal: totals.total + safeTip, tip: safeTip }
}
