import { useEffect, useMemo, useRef, useState } from 'react'
import { Receipt, Printer, Users, Check, Download, CreditCard, Banknote, Smartphone, Plus, X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { NumberField } from '../components/Field'
import { SegmentedControl } from '../components/SegmentedControl'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { isHard } from '../lib/skin'
import { inr } from '../lib/format'
import { consolidateLines, computeTotals, billNumber, withTip } from './waiter/billing'
import { Receipt as ReceiptBody } from './waiter/Receipt'
import { downloadCsv } from './manager/csv'
import {
  splitEvenly,
  splitByItems,
  amountPaid,
  remainingBalance,
  isSettled,
  distributeRoundingResidual,
  type SplitLine,
  type SplitShare,
  type Payment,
} from '../../lib/split'
import type { OrderRecord, Table } from '../lib/types'

type PaymentMethod = 'Cash' | 'Card' | 'UPI'
const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
]
const PAYMENT_ICON: Record<PaymentMethod, typeof CreditCard> = {
  Cash: Banknote,
  Card: CreditCard,
  UPI: Smartphone,
}

const TIP_PRESETS = [0, 5, 10, 15] as const

/** Pull the trailing digits off an order id (e.g. "ORD-00123" → 123) for a
 *  stable, deterministic bill sequence. Falls back to 0 when none are found. */
function seqFromOrderId(id: string): number {
  const digits = id.replace(/\D/g, '')
  return digits.length > 0 ? Number(digits) : 0
}

type SplitMode = 'none' | 'even' | 'by-guest' | 'by-item'
const SPLIT_OPTIONS: { value: SplitMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'even', label: 'Even' },
  { value: 'by-guest', label: 'By guest' },
  { value: 'by-item', label: 'By item' },
]

/**
 * Allocate `extra` rupees (non-item charges: service charge + tax + tip) across
 * guests in proportion to each guest's item subtotal, with exact-sum rounding so
 * the result always reconciles to `extra` (no stranded rupee). Returns one entry
 * per input share in the same order. When the item subtotals are all zero (e.g.
 * an empty bill or everything unassigned with no items), the extra is spread
 * evenly via the residual distributor.
 */
function allocateProportional(
  shares: readonly SplitShare[],
  extra: number,
): number[] {
  const n = shares.length
  if (n === 0) return []
  const base = shares.reduce((sum, s) => sum + s.amount, 0)
  // Seed each guest's floor share of `extra` proportional to their item subtotal.
  const seeded: SplitShare[] = shares.map(s => ({
    id: s.id,
    label: s.label,
    amount: base > 0 ? Math.floor((extra * s.amount) / base) : 0,
  }))
  // The residual distributor reconciles the floor-loss to hit `extra` exactly.
  return distributeRoundingResidual(seeded, extra).map(s => s.amount)
}

interface DeskRowProps {
  table: Table
  tabTotal: number
  selected: boolean
  onToggle: (id: string) => void
}

function DeskRow({ table, tabTotal, selected, onToggle }: DeskRowProps) {
  const { tokens: t } = useTheme()
  return (
    <button
      type="button"
      onClick={() => onToggle(table.id)}
      aria-pressed={selected}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors"
      style={{
        background: selected ? 'rgba(139,16,36,0.06)' : 'transparent',
        borderBottom: `1px solid ${t.ruleColor}`,
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-5 h-5 shrink-0"
        style={{
          borderRadius: isHard(t) ? 0 : 6,
          border: `1.5px solid ${selected ? t.accent : t.ruleColor}`,
          background: selected ? t.accent : 'transparent',
          color: '#fff',
        }}
      >
        {selected && <Check size={13} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
          {table.label}
        </span>
        <span className="block text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {table.guests} {table.guests === 1 ? 'guest' : 'guests'} · {table.zone}
        </span>
      </span>
      <span className="text-[13px] font-semibold shrink-0" style={{ color: t.ink, fontFamily: t.descFont }}>
        {inr(tabTotal)}
      </span>
    </button>
  )
}

export function Billing() {
  const { tokens: t } = useTheme()
  const { billingFocusTableId, currentWaiterId } = useViewCtx()
  const ops = useOpsStore()
  const { push } = useToast()

  const occupiedTables = useMemo(
    () => ops.state.tables.filter(tb => tb.status !== 'available'),
    [ops.state.tables],
  )

  // Unpaid orders grouped by table id, plus a running tab total per table.
  const unpaidByTable = useMemo(() => {
    const m = new Map<string, OrderRecord[]>()
    for (const o of ops.state.orders) {
      if (o.paid) continue
      const arr = m.get(o.tableId)
      if (arr) arr.push(o)
      else m.set(o.tableId, [o])
    }
    return m
  }, [ops.state.orders])

  const tabTotalFor = (tableId: string): number =>
    (unpaidByTable.get(tableId) ?? []).reduce((sum, o) => sum + o.total, 0)

  const [selected, setSelected] = useState<Set<string>>(() => {
    const init = new Set<string>()
    if (billingFocusTableId) init.add(billingFocusTableId)
    return init
  })
  const [discountPct, setDiscountPct] = useState(0)
  const [splitMode, setSplitMode] = useState<SplitMode>('none')
  const [evenWays, setEvenWays] = useState(2)
  const [itemWays, setItemWays] = useState(0)
  // By-item assignment: lineId → guest indices (0-based). Empty/missing ⇒ pooled.
  const [itemAssign, setItemAssign] = useState<Record<string, number[]>>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card')
  const [tipPct, setTipPct] = useState(0)
  // Partial / multi-tender payments. Component-local — no store entity.
  const [payments, setPayments] = useState<Payment[]>([])
  const [payAmount, setPayAmount] = useState<number | null>(null)
  // Monotonic id source — deriving ids from array length regenerates a stale id
  // after a remove+add (duplicate React keys), so use an ever-incrementing seq.
  const paySeq = useRef(0)

  // Re-focus when the caller jumps in pointing at a fresh table.
  useEffect(() => {
    if (billingFocusTableId) setSelected(new Set([billingFocusTableId]))
  }, [billingFocusTableId])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedTables = useMemo(
    () => occupiedTables.filter(tb => selected.has(tb.id)),
    [occupiedTables, selected],
  )

  const selectedOrders = useMemo(() => {
    const out: OrderRecord[] = []
    for (const tb of selectedTables) out.push(...(unpaidByTable.get(tb.id) ?? []))
    return out
  }, [selectedTables, unpaidByTable])

  const lines = useMemo(() => consolidateLines(selectedOrders), [selectedOrders])
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines])
  const totals = useMemo(() => computeTotals(subtotal, discountPct), [subtotal, discountPct])

  // Tip is computed off the post-tax total and added on top.
  const tip = useMemo(() => Math.round((totals.total * tipPct) / 100), [totals.total, tipPct])
  const grandTotal = useMemo(() => withTip(totals, tip).grandTotal, [totals, tip])

  const totalGuests = useMemo(
    () => selectedTables.reduce((s, tb) => s + tb.guests, 0),
    [selectedTables],
  )

  const deskLabel = selectedTables.map(tb => tb.label).join(' + ')

  // Default the by-item guest count to the table's guest count (min 2) the first
  // time it's needed, but let the waiter override it via the shared "Ways" field.
  const itemPeople = itemWays > 0 ? itemWays : Math.max(2, totalGuests)

  const ways = splitMode === 'by-guest' ? Math.max(1, totalGuests) : Math.max(1, Math.round(evenWays))

  // Even / by-guest: exact-sum even split — shares always add back to grandTotal.
  const evenResult = useMemo(
    () => (splitMode === 'even' || splitMode === 'by-guest' ? splitEvenly(grandTotal, ways) : null),
    [splitMode, grandTotal, ways],
  )

  // By-item: split the SUBTOTAL by line assignment, then allocate the non-item
  // charges (grandTotal − subtotal) proportionally so per-guest shares sum EXACTLY
  // to grandTotal. Unassigned lines pool across all guests (splitByItems default).
  const itemShares = useMemo<SplitShare[]>(() => {
    if (splitMode !== 'by-item') return []
    const guestIds = Array.from({ length: itemPeople }, (_, i) => `guest-${i + 1}`)
    const splitLines: SplitLine[] = lines.map(l => ({
      id: l.itemId,
      name: l.name,
      amount: l.price * l.qty,
      qty: l.qty,
    }))
    // Map stored guest indices → ids; seed every guest so the roster is complete
    // even when a guest has no items assigned yet.
    const assignment: Record<string, string[]> = {}
    for (const l of splitLines) {
      const idxs = itemAssign[l.id]
      if (idxs && idxs.length > 0) {
        assignment[l.id] = idxs.filter(i => i < itemPeople).map(i => guestIds[i])
      }
    }
    // Ensure the full guest roster is present (splitByItems derives it from the
    // assignment values), by pinning an empty-but-present anchor line.
    assignment['__roster__'] = guestIds
    const linesWithAnchor: SplitLine[] = [
      ...splitLines,
      { id: '__roster__', name: '', amount: 0, qty: 0 },
    ]
    const itemResult = splitByItems(linesWithAnchor, assignment)
    // itemResult shares carry the per-guest ITEM subtotal (sums to `subtotal`).
    const itemSubtotals: SplitShare[] = guestIds.map(id => {
      const s = itemResult.shares.find(sh => sh.id === id)
      return { id, label: id, amount: s ? s.amount : 0 }
    })
    const itemSubtotalSum = itemSubtotals.reduce((acc, s) => acc + s.amount, 0)
    const extra = grandTotal - itemSubtotalSum
    const extras = allocateProportional(itemSubtotals, extra)
    return itemSubtotals.map((s, i) => ({
      id: s.id,
      label: `Guest ${i + 1}`,
      amount: s.amount + extras[i],
    }))
  }, [splitMode, itemPeople, lines, itemAssign, grandTotal])

  const splitResult = splitMode === 'by-item' ? null : evenResult
  const shareAmounts = splitResult?.shares.map(s => s.amount) ?? []
  const minShare = shareAmounts.length ? Math.min(...shareAmounts) : 0
  const maxShare = shareAmounts.length ? Math.max(...shareAmounts) : 0
  const splitEven = minShare === maxShare
  const splitLabel =
    splitMode === 'by-item'
      ? `By item · ${itemPeople} ${itemPeople === 1 ? 'guest' : 'guests'}`
      : splitResult
        ? splitEven
          ? `Per head (${ways} ${ways === 1 ? 'way' : 'ways'}) · ${inr(minShare)}`
          : `${ways} ways · ${inr(minShare)}–${inr(maxShare)}`
        : null

  // Per-guest shares passed to the receipt (by-item lists each guest explicitly).
  const receiptShares: SplitShare[] | null =
    splitMode === 'by-item'
      ? itemShares
      : splitResult
        ? splitResult.shares.map((s, i) => ({ ...s, label: `Guest ${i + 1}` }))
        : null

  // Toggle a guest on/off for a given line (by-item assignment).
  const toggleAssign = (lineId: string, guestIdx: number) => {
    setItemAssign(prev => {
      const cur = prev[lineId] ?? []
      const next = cur.includes(guestIdx)
        ? cur.filter(i => i !== guestIdx)
        : [...cur, guestIdx].sort((a, b) => a - b)
      return { ...prev, [lineId]: next }
    })
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const paid = amountPaid(payments)
  const remaining = remainingBalance(grandTotal, payments)
  const settled = isSettled(grandTotal, payments)
  const hasPartials = payments.length > 0

  const addPayment = () => {
    const amt = payAmount == null || !Number.isFinite(payAmount) ? remaining : Math.round(payAmount)
    const clamped = Math.max(1, Math.min(amt, remaining))
    if (clamped <= 0) return
    setPayments(prev => [...prev, { id: `pay-${(paySeq.current += 1)}`, amount: clamped, method: paymentMethod }])
    setPayAmount(null)
  }

  const removePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  // Stable receipt timestamp: the earliest selected order's placedAt. Avoids
  // Date.now() churn so the bill number/date stay fixed while the bill is open.
  const placedAt = useMemo(() => {
    if (selectedOrders.length === 0) return null
    return selectedOrders.reduce((min, o) => Math.min(min, o.placedAt), selectedOrders[0].placedAt)
  }, [selectedOrders])

  // Bill number derives from the stable timestamp + the earliest order's id, so
  // it doesn't change with desk selection order on a merged bill.
  const billNo = useMemo(() => {
    if (placedAt == null || selectedOrders.length === 0) return null
    const earliest = selectedOrders.reduce((a, b) => (a.placedAt <= b.placedAt ? a : b))
    return billNumber(placedAt, seqFromOrderId(earliest.id))
  }, [placedAt, selectedOrders])

  const waiterName = useMemo(() => {
    const waiterId = selectedTables.find(tb => tb.waiterId)?.waiterId ?? currentWaiterId
    return ops.state.staff.find(s => s.id === waiterId)?.name ?? 'Unassigned'
  }, [selectedTables, currentWaiterId, ops.state.staff])

  const markPaid = () => {
    if (selected.size === 0) return
    // With a remaining balance and prior partial tenders, settling closes out
    // the outstanding amount as the final tender and marks the whole bill paid.
    if (hasPartials && remaining > 0) {
      push(`Settled remaining ${inr(remaining)} · ${paymentMethod}`, 'success')
    } else {
      push(`Bill settled · ${paymentMethod}`, 'success')
    }
    ops.payTables([...selected])
    setSelected(new Set())
    setDiscountPct(0)
    setSplitMode('none')
    setTipPct(0)
    setPaymentMethod('Card')
    setItemWays(0)
    setItemAssign({})
    setPayments([])
    setPayAmount(null)
  }

  const exportBill = () => {
    if (placedAt == null) return
    const columns = ['Item', 'Qty', 'Unit', 'Amount']
    const itemRows: Array<Array<string | number>> = lines.map(l => [
      l.name,
      l.qty,
      inr(l.price),
      inr(l.price * l.qty),
    ])
    const summaryRows: Array<Array<string | number>> = [
      ['', '', '', ''],
      ['Subtotal', '', '', inr(totals.subtotal)],
    ]
    if (totals.discountAmount > 0) {
      summaryRows.push([`Discount (${discountPct}%)`, '', '', `- ${inr(totals.discountAmount)}`])
    }
    summaryRows.push(['Service charge (5%)', '', '', inr(totals.serviceCharge)])
    summaryRows.push(['GST (5%)', '', '', inr(totals.tax)])
    if (tip > 0) summaryRows.push([`Tip (${tipPct}%)`, '', '', inr(tip)])
    summaryRows.push(['Total', '', '', inr(grandTotal)])
    summaryRows.push(['Payment', '', '', paymentMethod])

    // Split breakdown (per-guest shares), when a split is active.
    if (receiptShares && receiptShares.length > 0) {
      summaryRows.push(['', '', '', ''])
      summaryRows.push([`Split · ${splitMode}`, '', '', ''])
      for (const s of receiptShares) {
        summaryRows.push([s.label, '', '', inr(s.amount)])
      }
    }

    // Recorded tenders (partial / multi-tender payments), when any exist.
    if (payments.length > 0) {
      summaryRows.push(['', '', '', ''])
      summaryRows.push(['Payments', '', '', ''])
      for (const p of payments) {
        summaryRows.push([p.method ?? 'Payment', '', '', inr(p.amount)])
      }
      summaryRows.push(['Paid', '', '', inr(paid)])
      summaryRows.push(['Remaining', '', '', inr(remaining)])
    }

    const d = new Date(placedAt)
    const stamp = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d
      .getDate()
      .toString()
      .padStart(2, '0')}`
    const tablesJoined = selectedTables.map(tb => tb.id).join('-') || 'bill'
    downloadCsv(`relish-bill-${tablesJoined}-${stamp}.csv`, columns, [...itemRows, ...summaryRows])
    push('Bill exported as CSV', 'success')
  }

  const printReceipt = () => window.print()

  const cardRadius = isHard(t) ? 0 : 12

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Billing
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Select one or more desks to view or merge their bills
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Left — open tabs */}
        <Panel padded={false} className="no-print self-start">
          <header className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
              Open tabs
            </h2>
            <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {selected.size} selected
            </span>
          </header>
          {occupiedTables.length === 0 ? (
            <EmptyState title="No open tabs" description="Seated tables with orders appear here." />
          ) : (
            <div>
              {occupiedTables.map(tb => (
                <DeskRow
                  key={tb.id}
                  table={tb}
                  tabTotal={tabTotalFor(tb.id)}
                  selected={selected.has(tb.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Right — bill detail */}
        {selectedTables.length === 0 || billNo == null ? (
          <Panel>
            <EmptyState
              icon={<Receipt size={30} />}
              title="Select a desk to view its bill"
              description="Pick a table from the left. Choose several to merge them into one bill."
            />
          </Panel>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Controls — never printed */}
            <Panel className="no-print">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] leading-tight" style={{ fontFamily: t.headerFont, color: t.ink }}>
                      {deskLabel}
                    </h2>
                    <p className="text-[12px] mt-1 inline-flex items-center gap-1.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
                      <Users size={13} aria-hidden /> {totalGuests} {totalGuests === 1 ? 'guest' : 'guests'}
                      {selectedTables.length > 1 && ` · ${selectedTables.length} desks merged`}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: t.accent, fontFamily: t.descFont }}>
                    {billNo}
                  </span>
                </div>

                {/* Discount */}
                <NumberField
                  label="Discount %"
                  value={discountPct}
                  min={0}
                  onChange={v => setDiscountPct(Math.min(50, Math.max(0, Math.round(v))))}
                  hint="0–50% off the subtotal"
                />

                {/* Payment method */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                    Payment
                  </span>
                  <SegmentedControl<PaymentMethod>
                    options={PAYMENT_OPTIONS}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    ariaLabel="Payment method"
                    size="sm"
                  />
                </div>

                {/* Tip */}
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                    Tip {tip > 0 && <span style={{ color: t.descColor }}>· {inr(tip)}</span>}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TIP_PRESETS.map(p => {
                      const active = tipPct === p
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTipPct(p)}
                          aria-pressed={active}
                          className="px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors"
                          style={{
                            borderRadius: isHard(t) ? 0 : 8,
                            border: `1.5px solid ${active ? t.accent : t.ruleColor}`,
                            background: active ? t.accent : 'transparent',
                            color: active ? '#fff' : t.inkSoft,
                            fontFamily: t.descFont,
                          }}
                        >
                          {p}%
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Split */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                      Split bill
                    </span>
                    <SegmentedControl<SplitMode>
                      options={SPLIT_OPTIONS}
                      value={splitMode}
                      onChange={setSplitMode}
                      ariaLabel="Split mode"
                      size="sm"
                    />
                  </div>
                  {splitMode === 'even' && (
                    <div className="max-w-[180px]">
                      <NumberField label="Ways" value={evenWays} min={1} onChange={v => setEvenWays(Math.max(1, Math.round(v)))} />
                    </div>
                  )}
                  {splitMode === 'by-item' && (
                    <div className="max-w-[180px]">
                      <NumberField
                        label="Ways"
                        value={itemPeople}
                        min={1}
                        onChange={v => setItemWays(Math.max(1, Math.round(v)))}
                        hint="Guests to split items between"
                      />
                    </div>
                  )}

                  {/* By-item: assign each line to one or more guests. Unassigned
                      lines pool across everyone (matches splitByItems). */}
                  {splitMode === 'by-item' && (
                    <div
                      className="flex flex-col"
                      style={{ border: `1px solid ${t.ruleColor}`, borderRadius: cardRadius }}
                    >
                      {lines.length === 0 ? (
                        <p className="px-3 py-3 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                          No items to assign.
                        </p>
                      ) : (
                        lines.map((line, li) => {
                          const assigned = itemAssign[line.itemId] ?? []
                          const pooled = assigned.length === 0
                          return (
                            <div
                              key={line.itemId}
                              className="flex flex-col gap-2 px-3 py-2.5"
                              style={{ borderTop: li === 0 ? 'none' : `1px solid ${t.ruleColor}` }}
                            >
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-[13px] min-w-0 truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                                  <span className="font-semibold">{line.name}</span>
                                  <span style={{ color: t.descColor }}> × {line.qty}</span>
                                </span>
                                <span className="text-[12px] shrink-0 tabular-nums" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                                  {inr(line.price * line.qty)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Array.from({ length: itemPeople }, (_, gi) => {
                                  const on = assigned.includes(gi)
                                  return (
                                    <button
                                      key={gi}
                                      type="button"
                                      onClick={() => toggleAssign(line.itemId, gi)}
                                      aria-pressed={on}
                                      aria-label={`Assign ${line.name} to Guest ${gi + 1}`}
                                      className="px-2 py-1 text-[11px] font-semibold cursor-pointer transition-colors"
                                      style={{
                                        borderRadius: isHard(t) ? 0 : 8,
                                        border: `1.5px solid ${on ? t.accent : t.ruleColor}`,
                                        background: on ? t.accent : 'transparent',
                                        color: on ? '#fff' : t.inkSoft,
                                        fontFamily: t.descFont,
                                      }}
                                    >
                                      G{gi + 1}
                                    </button>
                                  )
                                })}
                                {pooled && (
                                  <span className="text-[11px] ml-0.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
                                    shared by all
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* By-item: per-guest totals (sum exactly to grand total). */}
                  {splitMode === 'by-item' && itemShares.length > 0 && (
                    <div
                      className="flex flex-col gap-1.5 px-3.5 py-3"
                      style={{
                        background: 'rgba(217,160,58,0.16)',
                        border: '1px solid rgba(217,160,58,0.55)',
                        borderRadius: cardRadius,
                      }}
                    >
                      {itemShares.map(s => (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                            {s.label}
                          </span>
                          <span className="text-[14px] font-bold tabular-nums" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                            {inr(s.amount)}
                          </span>
                        </div>
                      ))}
                      <span className="text-[11px] pt-0.5" style={{ color: '#8a6212', fontFamily: t.descFont, opacity: 0.85 }}>
                        Includes each guest's share of charges &amp; tip — sums exactly to {inr(grandTotal)}
                      </span>
                    </div>
                  )}

                  {splitResult != null && (
                    <div
                      className="flex flex-col gap-1 px-3.5 py-3"
                      style={{
                        background: 'rgba(217,160,58,0.16)',
                        border: '1px solid rgba(217,160,58,0.55)',
                        borderRadius: cardRadius,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                          Per head ({ways} {ways === 1 ? 'way' : 'ways'})
                        </span>
                        <span className="text-[16px] font-bold tabular-nums" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                          {splitEven ? inr(minShare) : `${inr(minShare)}–${inr(maxShare)}`}
                        </span>
                      </div>
                      {!splitEven && (
                        <span className="text-[11px]" style={{ color: '#8a6212', fontFamily: t.descFont, opacity: 0.85 }}>
                          {shareAmounts.filter(a => a === maxShare).length} pay {inr(maxShare)}, the rest {inr(minShare)} — sums exactly to {inr(grandTotal)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Partial / multi-tender payments */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                    Partial payments
                  </span>
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="max-w-[160px]">
                      <NumberField
                        label="Amount"
                        value={payAmount == null ? remaining : payAmount}
                        min={0}
                        prefix="₹"
                        onChange={v => setPayAmount(Math.max(0, Math.round(v)))}
                      />
                    </div>
                    <Button variant="subtle" size="sm" onClick={addPayment} aria-label="Add payment" disabled={remaining <= 0}>
                      <Plus size={14} aria-hidden /> Add payment
                    </Button>
                  </div>

                  {payments.length > 0 && (
                    <div
                      className="flex flex-col"
                      style={{ border: `1px solid ${t.ruleColor}`, borderRadius: cardRadius }}
                    >
                      {payments.map((p, pi) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                          style={{ borderTop: pi === 0 ? 'none' : `1px solid ${t.ruleColor}` }}
                        >
                          <span className="text-[13px]" style={{ color: t.ink, fontFamily: t.descFont }}>
                            {p.method ?? 'Payment'}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold tabular-nums" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                              {inr(p.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removePayment(p.id)}
                              aria-label={`Remove ${p.method ?? 'payment'} of ${inr(p.amount)}`}
                              className="inline-flex items-center justify-center w-5 h-5 cursor-pointer"
                              style={{ color: t.descColor }}
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </span>
                        </div>
                      ))}
                      <div
                        className="flex items-center justify-between gap-3 px-3 py-2"
                        style={{ borderTop: `1px solid ${t.ruleColor}` }}
                      >
                        <span className="text-[12px] font-semibold" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                          Paid {inr(paid)}
                        </span>
                        <span
                          className="text-[12px] font-bold tabular-nums"
                          style={{ color: settled ? '#2e7d32' : t.accent, fontFamily: t.descFont }}
                        >
                          {settled ? 'Settled' : `Remaining ${inr(remaining)}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <Button variant="primary" size="md" onClick={markPaid} className="flex-1">
                    {(() => {
                      const Icon = PAYMENT_ICON[paymentMethod]
                      return <Icon size={16} aria-hidden />
                    })()}{' '}
                    {hasPartials && remaining > 0
                      ? `Settle remaining ${inr(remaining)} · ${paymentMethod}`
                      : `Mark paid · ${paymentMethod}`}
                  </Button>
                  <Button variant="subtle" size="md" onClick={printReceipt} aria-label="Print receipt">
                    <Printer size={15} aria-hidden /> Print
                  </Button>
                  <Button variant="subtle" size="md" onClick={exportBill} aria-label="Export bill as CSV">
                    <Download size={15} aria-hidden /> Export CSV
                  </Button>
                </div>
              </div>
            </Panel>

            {/* Printable receipt — this is the print output */}
            <Panel className="print-area">
              <ReceiptBody
                billNo={billNo}
                placedAt={placedAt ?? 0}
                tableLabel={deskLabel}
                waiterName={waiterName}
                guests={totalGuests}
                lines={lines}
                totals={totals}
                tip={tip}
                grandTotal={grandTotal}
                paymentMethod={paymentMethod}
                splitLabel={splitLabel}
                splitShares={receiptShares}
                payments={payments}
                amountPaid={paid}
                remaining={remaining}
              />
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
