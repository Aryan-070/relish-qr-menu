import { useEffect, useMemo, useState } from 'react'
import { Receipt, Printer, Users, Check, Download, CreditCard, Banknote, Smartphone } from 'lucide-react'
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

type SplitMode = 'none' | 'even' | 'by-guest'
const SPLIT_OPTIONS: { value: SplitMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'even', label: 'Even' },
  { value: 'by-guest', label: 'By guest' },
]

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card')
  const [tipPct, setTipPct] = useState(0)

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

  const ways = splitMode === 'by-guest' ? Math.max(1, totalGuests) : Math.max(1, Math.round(evenWays))
  const perHead = splitMode === 'none' ? null : Math.round(grandTotal / ways)
  const splitLabel = perHead != null ? `Per head (${ways} ${ways === 1 ? 'way' : 'ways'}) · ${inr(perHead)}` : null

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
    ops.payTables([...selected])
    push(`Bill settled · ${paymentMethod}`, 'success')
    setSelected(new Set())
    setDiscountPct(0)
    setSplitMode('none')
    setTipPct(0)
    setPaymentMethod('Card')
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
                  {perHead != null && (
                    <div
                      className="flex items-center justify-between px-3.5 py-3"
                      style={{
                        background: 'rgba(217,160,58,0.16)',
                        border: '1px solid rgba(217,160,58,0.55)',
                        borderRadius: cardRadius,
                      }}
                    >
                      <span className="text-[13px] font-semibold" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                        Per head ({ways} {ways === 1 ? 'way' : 'ways'})
                      </span>
                      <span className="text-[16px] font-bold tabular-nums" style={{ color: '#8a6212', fontFamily: t.descFont }}>
                        {inr(perHead)}
                      </span>
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
                    Mark paid · {paymentMethod}
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
              />
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
