/**
 * accounting/export.ts — pure, dependency-free accounting exports.
 *
 * Converts billed {@link OrderRecord}s into the file formats two common
 * back-offices ingest:
 *
 * - {@link toTallyCsv} — a flat CSV voucher register suitable for import into
 *   Tally (and most spreadsheet-driven Indian bookkeeping). One row per order
 *   with taxable value, GST split (CGST/SGST/IGST), tax total and invoice total.
 * - {@link toQuickBooksJson} — a JSON array of sales-receipt objects shaped for
 *   QuickBooks-style import (line items + a tax line per order).
 *
 * Both functions are **I/O-free string producers** — no `fs`, no network, no
 * clock. They derive every tax figure from the shared {@link module:tax} engine
 * (`computeBillTax`) so the books reconcile exactly with the on-screen bill and
 * the printed receipt. Money is whole-rupee integers throughout.
 *
 * Voided and comped orders are excluded by default (they carry no revenue and
 * should not appear in the tax register); pass `includeNonRevenue: true` to
 * emit them with a zero/flagged value if an audit trail needs them.
 */

import type { OrderRecord } from '../../console/lib/types'
import {
  DEFAULT_TAX_CONFIG,
  computeBillTax,
  type TaxBreakdown,
  type TaxComponent,
  type TaxConfig,
} from '../tax'

/** Shared options for both exporters. */
export interface ExportOptions {
  /**
   * Include voided/comped orders (normally excluded as non-revenue). When
   * `true` they are emitted with their taxable value forced to `0`.
   */
  includeNonRevenue?: boolean
  /**
   * Apply each order's `discountPct` to its subtotal before taxing, mirroring
   * the billing view. Defaults to `true`.
   */
  applyDiscount?: boolean
}

/** Coerce arbitrary input to a safe, finite, non-negative whole-rupee amount. */
function safeAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/** True when an order should be excluded from a revenue/tax register. */
function isNonRevenue(order: OrderRecord): boolean {
  return order.voided === true || order.comp === true
}

/**
 * The post-discount taxable subtotal for an order. The stored `total` is the
 * pre-tax line sum; we apply the order's discount (clamped 0–100) when
 * `applyDiscount` is on, matching the billing view's whole-rupee rounding.
 */
function taxableSubtotal(order: OrderRecord, applyDiscount: boolean): number {
  const base = safeAmount(order.total)
  if (!applyDiscount || !order.discountPct) {
    return base
  }
  const pct = Math.min(100, Math.max(0, order.discountPct))
  const discount = Math.round(base * (pct / 100))
  return Math.max(0, base - discount)
}

/** Sum the amount of every component whose label matches `label`. */
function componentAmount(
  components: readonly TaxComponent[],
  label: string,
): number {
  return components
    .filter((c) => c.label === label)
    .reduce((acc, c) => acc + c.amount, 0)
}

/** A single order resolved to its tax breakdown, ready for either exporter. */
interface ResolvedOrder {
  order: OrderRecord
  subtotal: number
  tax: TaxBreakdown
}

/**
 * Resolve the orders we will export: filter non-revenue (unless asked to keep
 * them), then compute each one's tax breakdown via the shared engine.
 */
function resolveOrders(
  orders: readonly OrderRecord[],
  taxConfig: Readonly<TaxConfig>,
  opts: Required<ExportOptions>,
): ResolvedOrder[] {
  const resolved: ResolvedOrder[] = []
  for (const order of orders) {
    const nonRevenue = isNonRevenue(order)
    if (nonRevenue && !opts.includeNonRevenue) {
      continue
    }
    const subtotal = nonRevenue
      ? 0
      : taxableSubtotal(order, opts.applyDiscount)
    resolved.push({
      order,
      subtotal,
      tax: computeBillTax(subtotal, taxConfig),
    })
  }
  return resolved
}

/** Format an epoch timestamp as `YYYY-MM-DD` (local), deterministically. */
function isoDate(epochMs: number): string {
  const d = new Date(Number.isFinite(epochMs) ? epochMs : 0)
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Quote a CSV field per RFC 4180: wrap in double quotes and double any embedded
 * quotes when the value contains a comma, quote, or newline. Numbers/plain text
 * pass through unquoted.
 */
function csvField(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Join a row of fields into a single CSV line. */
function csvRow(fields: readonly (string | number)[]): string {
  return fields.map(csvField).join(',')
}

/** Column headers for the Tally voucher register. */
const TALLY_HEADERS: readonly string[] = [
  'Date',
  'Voucher No',
  'Voucher Type',
  'Table',
  'Taxable Value',
  'CGST',
  'SGST',
  'IGST',
  'Tax Total',
  'Invoice Total',
  'Status',
]

/**
 * Produce a Tally-importable CSV sales/voucher register from billed orders.
 *
 * One row per order: date, voucher number (the order id), voucher type
 * (`Sales`), table, taxable value, the GST split (CGST/SGST for intra-state or
 * IGST for inter-state — the unused columns are `0`), tax total, invoice total
 * and a status flag. Tax figures come from {@link computeBillTax} so they match
 * the bill exactly. Fields are RFC-4180 quoted; the first line is the header.
 *
 * @param orders    Orders to export (typically the day's paid orders).
 * @param taxConfig Venue tax config. Defaults to {@link DEFAULT_TAX_CONFIG}.
 * @param opts      Filtering/discount options. See {@link ExportOptions}.
 * @returns         A CSV string (header + one row per order). Empty input still
 *                  returns the header row.
 *
 * @example
 *   toTallyCsv(paidOrders) // "Date,Voucher No,…\n2026-06-02,ORD-00123,Sales,…"
 */
export function toTallyCsv(
  orders: readonly OrderRecord[],
  taxConfig: Readonly<TaxConfig> = DEFAULT_TAX_CONFIG,
  opts: ExportOptions = {},
): string {
  const resolvedOpts: Required<ExportOptions> = {
    includeNonRevenue: opts.includeNonRevenue ?? false,
    applyDiscount: opts.applyDiscount ?? true,
  }
  const resolved = resolveOrders(orders, taxConfig, resolvedOpts)

  const rows: string[] = [csvRow(TALLY_HEADERS)]
  for (const { order, subtotal, tax } of resolved) {
    const cgst = componentAmount(tax.components, 'CGST')
    const sgst = componentAmount(tax.components, 'SGST')
    const igst = componentAmount(tax.components, 'IGST')
    const status = order.voided
      ? 'Voided'
      : order.comp
        ? 'Comp'
        : order.paid
          ? 'Paid'
          : 'Open'
    rows.push(
      csvRow([
        isoDate(order.placedAt),
        order.id,
        'Sales',
        order.tableId,
        subtotal,
        cgst,
        sgst,
        igst,
        tax.taxTotal,
        tax.grandTotal,
        status,
      ]),
    )
  }
  return rows.join('\n')
}

/** A line item inside a QuickBooks-style sales receipt. */
export interface QuickBooksLine {
  description: string
  quantity: number
  unitAmount: number
  amount: number
}

/** A single QuickBooks-style sales receipt (one per order). */
export interface QuickBooksReceipt {
  docNumber: string
  txnDate: string
  customerRef: string
  currency: string
  lineItems: QuickBooksLine[]
  taxComponents: { name: string; rate: number; amount: number }[]
  subTotal: number
  taxTotal: number
  totalAmount: number
  status: string
}

/**
 * Produce a QuickBooks-style JSON string (an array of sales receipts) from
 * billed orders.
 *
 * Each order becomes one receipt: its order lines map to `lineItems`
 * (description, quantity, unit + extended amount), the GST breakdown from
 * {@link computeBillTax} maps to `taxComponents`, and the sub-total / tax total
 * / grand total are echoed for easy reconciliation. The result is
 * `JSON.stringify`'d with 2-space indentation so it is human-readable and
 * diff-friendly.
 *
 * @param orders    Orders to export.
 * @param taxConfig Venue tax config. Defaults to {@link DEFAULT_TAX_CONFIG}.
 * @param opts      Filtering/discount options. See {@link ExportOptions}.
 * @returns         A pretty-printed JSON array string (currency `INR`).
 *
 * @example
 *   const json = toQuickBooksJson(paidOrders)
 *   // '[\n  { "docNumber": "ORD-00123", … } ]'
 */
export function toQuickBooksJson(
  orders: readonly OrderRecord[],
  taxConfig: Readonly<TaxConfig> = DEFAULT_TAX_CONFIG,
  opts: ExportOptions = {},
): string {
  const resolvedOpts: Required<ExportOptions> = {
    includeNonRevenue: opts.includeNonRevenue ?? false,
    applyDiscount: opts.applyDiscount ?? true,
  }
  const resolved = resolveOrders(orders, taxConfig, resolvedOpts)

  const receipts: QuickBooksReceipt[] = resolved.map(
    ({ order, subtotal, tax }) => {
      const lineItems: QuickBooksLine[] = order.lines.map((line) => {
        const qty = Number.isFinite(line.qty) && line.qty > 0 ? line.qty : 0
        const unitAmount = safeAmount(line.price)
        return {
          description: line.name,
          quantity: qty,
          unitAmount,
          amount: unitAmount * qty,
        }
      })

      return {
        docNumber: order.id,
        txnDate: isoDate(order.placedAt),
        customerRef: order.tableId,
        currency: 'INR',
        lineItems,
        taxComponents: tax.components.map((c) => ({
          name: c.label,
          rate: c.pct,
          amount: c.amount,
        })),
        subTotal: subtotal,
        taxTotal: tax.taxTotal,
        totalAmount: tax.grandTotal,
        status: order.voided
          ? 'Voided'
          : order.comp
            ? 'Comp'
            : order.paid
              ? 'Paid'
              : 'Open',
      }
    },
  )

  return JSON.stringify(receipts, null, 2)
}
