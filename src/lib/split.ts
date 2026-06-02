/**
 * split.ts — pure, dependency-free split-bill + partial-payment engine for Relish.
 *
 * Restaurant-grade bill splitting (Sunday / Toast style) with a hard correctness
 * guarantee: **every split sums back EXACTLY to the original total**, with zero
 * stranded rupees. This is Phase 3 groundwork — a later UI (see the inline split
 * math in `src/screens/ServicePanel.tsx`) will consume these functions.
 *
 * ## Money convention
 * Like {@link ../lib/money.ts}, all amounts are plain integers in the **major
 * unit** (whole rupees, ₹ — no paise). Inputs are coerced to safe, non-negative
 * integers at the boundary; outputs are always integers. There is no
 * floating-point money in this module, so there is no floating-point drift.
 *
 * ## The exact-sum invariant (the core promise)
 * For every function that produces `shares`:
 *
 *     Σ shares[i].amount  ===  total            // INVARIANT (I)
 *     result.remainder    ===  0                // after distribution
 *
 * Integer division of `total` by `n` people loses a remainder `r = total % n`
 * (e.g. ₹100 / 3 = ₹33 each, leaving ₹1 stranded). Naively every share would be
 * ₹33 and Σ = ₹99 ≠ ₹100. We fix this with {@link distributeRoundingResidual}:
 * the `r` leftover rupees are handed out, one each, to the first `r` shares. So
 * ₹100 / 3 → [34, 33, 33] (Σ = 100, exact). This is deterministic and stable —
 * the same input always yields the same distribution — and is the classic cure
 * for the "stranded ₹0.50 after a 6-way split" bug.
 *
 * @example Even split with exact-sum residual distribution
 *   splitEvenly(100, 3).shares.map(s => s.amount)  // [34, 33, 33]  Σ = 100
 *
 * @example Round-up split that over-collects (the difference becomes tip)
 *   splitEvenly(100, 3, { roundTo: 10 })
 *   // shares: [40, 40, 40] (Σ = 120), overage: 20  ← collected > total
 */

import { formatMoney } from './money'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * How a bill is divided.
 *
 * - `even`     — split equally across N people.
 * - `by-item`  — each line is assigned to one or more participants; shared lines
 *                are split equally among their assignees.
 * - `by-guest` — each guest pays for their own pre-tallied subtotal.
 * - `custom`   — caller-supplied shares (still validated to sum exactly).
 *
 * Note: this is a superset of the console's `SplitMode`
 * (`'none' | 'even' | 'by-guest'` in `src/console/lib/types.ts`) — the engine
 * adds `by-item` and `custom`.
 */
export type SplitMode = 'even' | 'by-item' | 'by-guest' | 'custom'

/** A single payer's share of the bill. `amount` is whole rupees. */
export interface SplitShare {
  /** Stable identifier for the payer/participant (e.g. `'guest-1'`, `'W3'`). */
  id: string
  /** Human-readable label for the UI (e.g. `'Guest 1'`, `'Aanya'`). */
  label: string
  /** This payer's portion of the bill, in whole rupees. Always an integer ≥ 0. */
  amount: number
}

/**
 * The result of any split operation.
 *
 * `remainder` is always `0` after distribution — it is exposed purely so tests
 * (and defensive callers) can assert the exact-sum invariant held. A non-zero
 * value would indicate a bug in this module.
 */
export interface SplitResult {
  /** Which strategy produced these shares. */
  mode: SplitMode
  /** Per-payer shares. `Σ shares[i].amount === total` (invariant I). */
  shares: SplitShare[]
  /** The figure the shares were balanced against (whole rupees). */
  total: number
  /** Residual left undistributed. Always `0` here; exposed for test assertions. */
  remainder: number
}

/** A guest's own pre-tallied subtotal, used by {@link splitByGuests}. */
export interface GuestSubtotal {
  id: string
  label: string
  /** This guest's own items total, in whole rupees. */
  amount: number
}

/** A single bill line, used by {@link splitByItems}. */
export interface SplitLine {
  /** Stable line id, used as the key in the assignment map. */
  id: string
  /** Display name (e.g. `'Paneer Tikka'`). */
  name: string
  /** Line total (already `unitPrice × qty`), in whole rupees. */
  amount: number
  /** Quantity ordered (informational; `amount` is authoritative for the math). */
  qty: number
}

/** Options shared by the even-split family. */
export interface SplitEvenlyOptions {
  /**
   * Round each person's share **up** to the nearest multiple of this step
   * (e.g. `10` → nearest ₹10). The extra collected above `total` is returned as
   * `overage` (tip / "collected > total"). When omitted, shares sum to `total`
   * exactly via residual distribution and `overage` is `0`.
   */
  roundTo?: number
}

/** Result of an even split, extending {@link SplitResult} with round-up overage. */
export interface SplitEvenlyResult extends SplitResult {
  /**
   * Amount collected **above** `total` due to round-up (`Σ shares − total`).
   * `0` when `roundTo` is not used. When non-zero, `Σ shares === total + overage`
   * and the invariant is relative to that collected figure (see `collected`).
   */
  overage: number
  /** What is actually collected from payers: `total + overage`. */
  collected: number
}

/** A tip directive: a percentage of the total, or a flat rupee amount. */
export interface TipInput {
  mode: 'pct' | 'amount'
  /** Percent (e.g. `10` = 10%) when `mode: 'pct'`, else flat rupees. */
  value: number
}

/** Result of {@link applyTip}. */
export interface AppliedTip {
  /** Tip in whole rupees (rounded to nearest rupee for `pct`). */
  tip: number
  /** `total + tip`, in whole rupees. */
  grandTotal: number
}

/** A recorded payment against a bill (partial / multi-tender). */
export interface Payment {
  id: string
  /** Amount tendered, in whole rupees. Coerced to a non-negative integer. */
  amount: number
  /** Optional tender method (e.g. `'cash'`, `'card'`, `'upi'`). */
  method?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Internal numeric guards (boundary validation — never trust external data)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Coerce arbitrary numeric input into a safe, finite, non-negative integer.
 * Guards against `NaN`, `Infinity`, negatives, and fractional rupees leaking
 * into the engine. Negative and non-finite inputs collapse to `0`.
 */
function toRupees(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount)
}

/**
 * Coerce a "count of people/steps" into a safe positive integer, or `0` when the
 * input is not a usable count (callers treat `0` as the single-share fallback).
 */
function toCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

// ────────────────────────────────────────────────────────────────────────────
// Residual distribution — the heart of the exact-sum guarantee
// ────────────────────────────────────────────────────────────────────────────

/**
 * Adjust `shares` so they sum **exactly** to `total`, distributing any rounding
 * residual one rupee at a time across the leading shares (or trimming from them
 * when the shares over-shoot). This is the single source of truth for the
 * exact-sum invariant (I) and is exported so tests can verify it directly.
 *
 * Algorithm:
 *   1. `diff = total − Σ shares`.
 *   2. If `diff > 0`: add ₹1 to each of the first `diff` shares (cycling if
 *      `diff` exceeds the share count — though in practice `|diff| < n`).
 *   3. If `diff < 0`: remove ₹1 from each of the first `|diff|` shares, never
 *      letting a share go below `0` (overflow rupees cascade to later shares).
 *   4. Result: `Σ adjusted === total`, guaranteed.
 *
 * The operation is immutable — it returns a new array and never mutates inputs.
 * When `shares` is empty, the (unsplittable) total cannot be placed, so an empty
 * array is returned unchanged; callers guarantee at least one share before
 * relying on the invariant.
 *
 * @example Hand out a positive residual to the leading shares
 *   distributeRoundingResidual(
 *     [{ id: 'a', label: 'A', amount: 33 },
 *      { id: 'b', label: 'B', amount: 33 },
 *      { id: 'c', label: 'C', amount: 33 }],
 *     100,
 *   ).map(s => s.amount)  // [34, 33, 33]  Σ = 100
 *
 * @example Trim a negative residual (shares over-shot the total)
 *   distributeRoundingResidual(
 *     [{ id: 'a', label: 'A', amount: 34 },
 *      { id: 'b', label: 'B', amount: 34 }],
 *     67,
 *   ).map(s => s.amount)  // [33, 34]  Σ = 67
 */
export function distributeRoundingResidual(
  shares: readonly SplitShare[],
  total: number,
): SplitShare[] {
  const target = toRupees(total)
  const n = shares.length
  if (n === 0) return []

  // Work on a normalised copy (each amount already a safe integer).
  const next: SplitShare[] = shares.map((s) => ({
    id: s.id,
    label: s.label,
    amount: toRupees(s.amount),
  }))

  const current = next.reduce((sum, s) => sum + s.amount, 0)
  let diff = target - current

  if (diff > 0) {
    // Distribute surplus rupees, one each, cycling across shares as needed.
    let i = 0
    while (diff > 0) {
      next[i % n] = { ...next[i % n], amount: next[i % n].amount + 1 }
      diff -= 1
      i += 1
    }
  } else if (diff < 0) {
    // Reclaim excess rupees, one each, skipping shares already at 0.
    let deficit = -diff
    let i = 0
    // `guard` bounds the loop: at most we touch every share once per rupee.
    const guard = deficit + n + 1
    let steps = 0
    while (deficit > 0 && steps < guard * n) {
      const idx = i % n
      if (next[idx].amount > 0) {
        next[idx] = { ...next[idx], amount: next[idx].amount - 1 }
        deficit -= 1
      }
      i += 1
      steps += 1
    }
  }

  return next
}

/**
 * Build a `SplitResult`, re-deriving `remainder` from the (already-balanced)
 * shares so the value is honest rather than assumed.
 */
function makeResult(
  mode: SplitMode,
  shares: SplitShare[],
  total: number,
): SplitResult {
  const sum = shares.reduce((acc, s) => acc + s.amount, 0)
  return { mode, shares, total, remainder: total - sum }
}

// ────────────────────────────────────────────────────────────────────────────
// Even split
// ────────────────────────────────────────────────────────────────────────────

/**
 * Split `total` evenly across `people`, guaranteeing the shares sum exactly to
 * `total` (no stranded rupees).
 *
 * Behaviour:
 * - `people <= 0`        → a single share equal to the whole `total`.
 * - `total <= 0`         → every share is `0`.
 * - **default**          → `floor(total / people)` each, then the residual
 *                          `total % people` is handed to the first shares via
 *                          {@link distributeRoundingResidual}. `overage = 0`.
 * - **`roundTo` given**  → each share is rounded **up** to the nearest `roundTo`
 *                          step; the amount collected above `total` is returned
 *                          as `overage` (tip). Shares are equal by construction,
 *                          so no residual distribution is needed.
 *
 * @param total   Bill total in whole rupees.
 * @param people  Number of payers.
 * @param opts    See {@link SplitEvenlyOptions}.
 * @returns       A {@link SplitEvenlyResult} (`remainder === 0`).
 *
 * @example
 *   splitEvenly(100, 3).shares.map(s => s.amount)            // [34, 33, 33]
 *   splitEvenly(100, 3, { roundTo: 10 }).overage             // 20
 *   splitEvenly(900, 6).shares.map(s => s.amount)            // [150, …] Σ = 900
 */
export function splitEvenly(
  total: number,
  people: number,
  opts?: SplitEvenlyOptions,
): SplitEvenlyResult {
  const safeTotal = toRupees(total)
  const n = toCount(people)
  const roundTo = opts?.roundTo !== undefined ? toCount(opts.roundTo) : 0

  // Degenerate: nobody to split across → one payer owes the whole bill.
  if (n === 0) {
    const shares: SplitShare[] = [
      { id: 'payer-1', label: 'Everyone', amount: safeTotal },
    ]
    return {
      ...makeResult('even', shares, safeTotal),
      overage: 0,
      collected: safeTotal,
    }
  }

  const labels = (i: number): SplitShare => ({
    id: `payer-${i + 1}`,
    label: `Person ${i + 1}`,
    amount: 0,
  })

  // Round-up mode: every share equal, collected may exceed total (→ tip).
  if (roundTo > 0) {
    const rawPer = safeTotal / n
    const per = Math.ceil(rawPer / roundTo) * roundTo
    const shares: SplitShare[] = Array.from({ length: n }, (_, i) => ({
      ...labels(i),
      amount: per,
    }))
    const collected = per * n
    return {
      mode: 'even',
      shares,
      total: safeTotal,
      remainder: 0, // by construction: shares are equal, residual is the overage
      overage: collected - safeTotal,
      collected,
    }
  }

  // Default mode: floor each, then distribute the `total % n` residual exactly.
  const base = Math.floor(safeTotal / n)
  const seeded: SplitShare[] = Array.from({ length: n }, (_, i) => ({
    ...labels(i),
    amount: base,
  }))
  const balanced = distributeRoundingResidual(seeded, safeTotal)
  return {
    ...makeResult('even', balanced, safeTotal),
    overage: 0,
    collected: safeTotal,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Split by guests (each pays for their own items)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build one share per guest from each guest's own pre-tallied subtotal. This is
 * a validated passthrough: each guest pays exactly what their own items came to.
 *
 * The returned `total` is the sum of all guest subtotals, and because each share
 * is the guest's own (integer-coerced) amount, the exact-sum invariant holds by
 * definition — `distributeRoundingResidual` is applied as a belt-and-braces
 * guard in case any subtotal was fractional and got rounded.
 *
 * @param guestSubtotals One entry per guest with their own items total.
 * @returns A {@link SplitResult} with `mode: 'by-guest'` and `remainder === 0`.
 *
 * @example
 *   splitByGuests([
 *     { id: 'g1', label: 'Aanya', amount: 420 },
 *     { id: 'g2', label: 'Rohan', amount: 380 },
 *   ]).total  // 800
 */
export function splitByGuests(
  guestSubtotals: readonly GuestSubtotal[],
): SplitResult {
  if (guestSubtotals.length === 0) {
    return { mode: 'by-guest', shares: [], total: 0, remainder: 0 }
  }

  const seeded: SplitShare[] = guestSubtotals.map((g) => ({
    id: g.id,
    label: g.label,
    amount: toRupees(g.amount),
  }))
  const total = seeded.reduce((sum, s) => sum + s.amount, 0)

  // Belt-and-braces: subtotals are already exact, but re-balance to be certain.
  const balanced = distributeRoundingResidual(seeded, total)
  return makeResult('by-guest', balanced, total)
}

// ────────────────────────────────────────────────────────────────────────────
// Split by items (per-line assignment, shared items split equally)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Divide a bill line-by-line. Each line is assigned to one or more participant
 * ids; the line's amount is split **equally** among its assignees (with exact-sum
 * rounding so shared lines never strand a rupee). Lines with no assignment (or an
 * empty assignee list) fall into a shared pool split among **all** participants
 * seen across the assignment map.
 *
 * Per-line residuals are distributed deterministically across that line's
 * assignees, then the per-participant totals are summed. A final
 * {@link distributeRoundingResidual} pass over the grand total guarantees the
 * invariant end-to-end even as many small line residuals accumulate.
 *
 * Participant **order and identity** is derived from the assignment map's value
 * arrays (first-seen order), so labels fall back to the id when unknown.
 *
 * @param lines       The bill lines (`amount` is authoritative).
 * @param assignment  Map of `lineId → participantId[]`. Missing/empty ⇒ pooled.
 * @returns A {@link SplitResult} with `mode: 'by-item'` and `remainder === 0`.
 *
 * @example Two diners, one shared starter
 *   splitByItems(
 *     [
 *       { id: 'l1', name: 'Dal',     amount: 200, qty: 1 },  // → a
 *       { id: 'l2', name: 'Naan',    amount: 120, qty: 1 },  // → b
 *       { id: 'l3', name: 'Starter', amount: 101, qty: 1 },  // → a + b (split)
 *     ],
 *     { l1: ['a'], l2: ['b'], l3: ['a', 'b'] },
 *   )
 *   // a: 200 + 51 = 251, b: 120 + 50 = 170   Σ = 421 (= 200+120+101)
 */
export function splitByItems(
  lines: readonly SplitLine[],
  assignment: Readonly<Record<string, readonly string[]>>,
): SplitResult {
  // 1. Establish the participant roster in first-seen order across the map.
  const order: string[] = []
  const seen = new Set<string>()
  for (const ids of Object.values(assignment)) {
    for (const pid of ids) {
      if (!seen.has(pid)) {
        seen.add(pid)
        order.push(pid)
      }
    }
  }

  const grandTotal = lines.reduce((sum, l) => sum + toRupees(l.amount), 0)

  // No participants at all → single pooled share for the whole bill.
  if (order.length === 0) {
    const shares: SplitShare[] = [
      { id: 'pool', label: 'Shared', amount: grandTotal },
    ]
    return makeResult('by-item', shares, grandTotal)
  }

  // Running per-participant totals, keyed by id.
  const totals = new Map<string, number>(order.map((id) => [id, 0]))

  /**
   * Split one line's amount equally across `assignees` (exact-sum), adding each
   * resulting share into the running `totals`.
   */
  const allocateLine = (amount: number, assignees: readonly string[]): void => {
    const amt = toRupees(amount)
    if (assignees.length === 0) return
    const base = Math.floor(amt / assignees.length)
    const seeded: SplitShare[] = assignees.map((pid) => ({
      id: pid,
      label: pid,
      amount: base,
    }))
    const balanced = distributeRoundingResidual(seeded, amt)
    for (const s of balanced) {
      totals.set(s.id, (totals.get(s.id) ?? 0) + s.amount)
    }
  }

  for (const line of lines) {
    const assignees = assignment[line.id]
    const targets =
      assignees && assignees.length > 0 ? assignees : order // pooled fallback
    allocateLine(line.amount, targets)
  }

  // 2. Materialise shares in roster order.
  const seededShares: SplitShare[] = order.map((id) => ({
    id,
    label: id,
    amount: totals.get(id) ?? 0,
  }))

  // 3. Final guard: reconcile any accumulated cross-line residual to the total.
  const balanced = distributeRoundingResidual(seededShares, grandTotal)
  return makeResult('by-item', balanced, grandTotal)
}

// ────────────────────────────────────────────────────────────────────────────
// Tip
// ────────────────────────────────────────────────────────────────────────────

/**
 * Apply a tip to a total, returning the tip and the grand total (both whole
 * rupees). Percentage tips are rounded to the nearest rupee.
 *
 * @example
 *   applyTip(1000, { mode: 'pct', value: 10 })     // { tip: 100, grandTotal: 1100 }
 *   applyTip(1000, { mode: 'amount', value: 150 }) // { tip: 150, grandTotal: 1150 }
 *   applyTip(333,  { mode: 'pct', value: 10 })     // { tip: 33,  grandTotal: 366 }
 */
export function applyTip(total: number, tip: TipInput): AppliedTip {
  const safeTotal = toRupees(total)
  const value = Number.isFinite(tip.value) && tip.value > 0 ? tip.value : 0
  const tipAmount =
    tip.mode === 'pct' ? Math.round((safeTotal * value) / 100) : toRupees(value)
  return { tip: tipAmount, grandTotal: safeTotal + tipAmount }
}

/**
 * Even-split a bill **including tip** with the exact-sum guarantee. Equivalent to
 * `splitEvenly(applyTip(total, tip).grandTotal, people, opts)` but returns the
 * tip alongside so callers can show a breakdown.
 *
 * @returns The even-split result for `total + tip`, plus the computed `tip`.
 *
 * @example
 *   splitWithTip(1000, 3, { mode: 'pct', value: 10 })
 *   // tip 100 → split 1100 / 3 = [367, 367, 366]  Σ = 1100
 */
export function splitWithTip(
  total: number,
  people: number,
  tip: TipInput,
  opts?: SplitEvenlyOptions,
): SplitEvenlyResult & { tip: number } {
  const applied = applyTip(total, tip)
  const result = splitEvenly(applied.grandTotal, people, opts)
  return { ...result, tip: applied.tip }
}

// ────────────────────────────────────────────────────────────────────────────
// Partial / multi-tender payments
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sum all recorded payments, in whole rupees. Each payment is integer-coerced
 * and floored at `0`, so malformed entries cannot push the total negative.
 *
 * @example
 *   amountPaid([{ id: 'p1', amount: 400 }, { id: 'p2', amount: 200 }])  // 600
 */
export function amountPaid(payments: readonly Payment[]): number {
  return payments.reduce((sum, p) => sum + toRupees(p.amount), 0)
}

/**
 * Remaining balance owed on a bill: `total − amountPaid`, **never negative**
 * (over-payment / tip clamps to `0`). Whole rupees.
 *
 * @example
 *   remainingBalance(1000, [{ id: 'p1', amount: 400 }])               // 600
 *   remainingBalance(1000, [{ id: 'p1', amount: 1200 }])              // 0  (over-paid)
 */
export function remainingBalance(
  total: number,
  payments: readonly Payment[],
): number {
  return Math.max(0, toRupees(total) - amountPaid(payments))
}

/**
 * Whether a bill is fully settled (paid in full or over-paid).
 *
 * @example
 *   isSettled(1000, [{ id: 'p1', amount: 1000 }])  // true
 *   isSettled(1000, [{ id: 'p1', amount: 600 }])   // false
 */
export function isSettled(total: number, payments: readonly Payment[]): boolean {
  return remainingBalance(total, payments) === 0
}

// ────────────────────────────────────────────────────────────────────────────
// Display helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format a share for display using the app's money formatter (₹, en-IN). Thin
 * convenience wrapper so split UIs render consistently with the rest of Relish.
 *
 * @example
 *   formatShare({ id: 'a', label: 'A', amount: 34 })  // "₹34"
 */
export function formatShare(share: SplitShare): string {
  return formatMoney(share.amount)
}
