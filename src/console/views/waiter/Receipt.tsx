// Presentational receipt — rendered on-screen inside the Billing panel and
// reused verbatim for printing (it lives inside Billing's `.print-area`).
// Pure props in, no store/context access beyond the theme. Money is rendered
// with tabular-nums so columns line up both on screen and on paper.

import { useTheme } from '../../../theme/ThemeContext'
import { inr, clockTime } from '../../lib/format'
import type { ComputedTotals } from './billing'

interface ReceiptLine {
  itemId: string
  name: string
  qty: number
  price: number
}

interface ReceiptProps {
  billNo: string
  placedAt: number
  tableLabel: string
  waiterName: string
  guests: number
  lines: ReceiptLine[]
  totals: ComputedTotals
  tip: number
  grandTotal: number
  paymentMethod: string
  splitLabel?: string | null
}

/** "2 Jun 2026" from an epoch-ms timestamp. */
function billDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface MetaCellProps {
  label: string
  value: string
}

function MetaCell({ label, value }: MetaCellProps) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: t.descColor }}>
        {label}
      </span>
      <span className="text-[12px] font-semibold" style={{ color: t.ink }}>
        {value}
      </span>
    </div>
  )
}

interface SummaryRowProps {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}

function SummaryRow({ label, value, strong, muted }: SummaryRowProps) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span style={{ color: muted ? t.descColor : t.inkSoft, fontWeight: strong ? 700 : 400 }}>
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{ color: strong ? t.ink : t.inkSoft, fontWeight: strong ? 800 : 600 }}
      >
        {value}
      </span>
    </div>
  )
}

export function Receipt({
  billNo,
  placedAt,
  tableLabel,
  waiterName,
  guests,
  lines,
  totals,
  tip,
  grandTotal,
  paymentMethod,
  splitLabel,
}: ReceiptProps) {
  const { tokens: t } = useTheme()
  const rule = `1px solid ${t.ruleColor}`
  const dashed = `1px dashed ${t.ruleColor}`

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: t.descFont, color: t.ink }}>
      {/* Brand header */}
      <div className="text-center flex flex-col gap-1 pb-3" style={{ borderBottom: dashed }}>
        <h2 className="text-[26px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Relish
        </h2>
        <p className="text-[11px]" style={{ color: t.descColor }}>
          International Veg Cuisine · 12 Garden Lane
        </p>
      </div>

      {/* Bill meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetaCell label="Bill No." value={billNo} />
        <div className="flex flex-col gap-0.5 text-right items-end">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: t.descColor }}>
            Date
          </span>
          <span className="text-[12px] font-semibold" style={{ color: t.ink }}>
            {billDate(placedAt)} · {clockTime(placedAt)}
          </span>
        </div>
        <MetaCell label="Table" value={tableLabel} />
        <div className="flex flex-col gap-0.5 text-right items-end">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: t.descColor }}>
            Server
          </span>
          <span className="text-[12px] font-semibold" style={{ color: t.ink }}>
            {waiterName}
          </span>
        </div>
        <MetaCell label="Guests" value={`${guests} ${guests === 1 ? 'guest' : 'guests'}`} />
      </div>

      {/* Itemized lines */}
      <div className="flex flex-col" style={{ borderTop: rule, borderBottom: rule }}>
        <div
          className="flex items-baseline justify-between py-1.5 text-[10px] uppercase tracking-wider"
          style={{ color: t.descColor, borderBottom: dashed }}
        >
          <span>Item</span>
          <span>Amount</span>
        </div>
        {lines.length === 0 ? (
          <p className="py-3 text-[13px]" style={{ color: t.descColor }}>
            No items on this bill.
          </p>
        ) : (
          <ul className="flex flex-col">
            {lines.map(line => (
              <li
                key={line.itemId}
                className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]"
              >
                <span style={{ color: t.ink }}>
                  <span className="font-semibold">{line.name}</span>
                  <span style={{ color: t.descColor }}> × {line.qty}</span>
                </span>
                <span className="shrink-0 tabular-nums" style={{ color: t.inkSoft }}>
                  {inr(line.price * line.qty)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="flex flex-col gap-1.5">
        <SummaryRow label="Subtotal" value={inr(totals.subtotal)} />
        {totals.discountAmount > 0 && (
          <SummaryRow label="Discount" value={`− ${inr(totals.discountAmount)}`} muted />
        )}
        <SummaryRow label="Service charge (5%)" value={inr(totals.serviceCharge)} muted />
        <SummaryRow label="GST (5%)" value={inr(totals.tax)} muted />
        {tip > 0 && <SummaryRow label="Tip" value={inr(tip)} muted />}
        <div className="my-1" style={{ borderTop: dashed }} />
        <SummaryRow label="Total" value={inr(grandTotal)} strong />
        {splitLabel && (
          <div className="flex items-baseline justify-between text-[12px] pt-0.5">
            <span style={{ color: t.descColor }}>{splitLabel}</span>
          </div>
        )}
      </div>

      {/* Payment + footer */}
      <div className="flex items-center justify-between pt-3 text-[13px]" style={{ borderTop: rule }}>
        <span style={{ color: t.inkSoft }}>Payment</span>
        <span className="font-semibold" style={{ color: t.ink }}>
          {paymentMethod}
        </span>
      </div>

      <p className="text-center text-[11px] pt-1" style={{ color: t.descColor }}>
        Thank you for dining with us · GSTIN 29ABCDE1234F1Z5 (demo)
      </p>
    </div>
  )
}
