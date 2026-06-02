/**
 * escpos.ts — pure, dependency-free ESC/POS-style ticket builder.
 *
 * This module turns an {@link OrderRecord} (or a billed total) into the plain,
 * monospace text a thermal kitchen/receipt printer renders. It is intentionally
 * **I/O-free**: there is no `window`, no network, no `Date.now()` at module
 * scope — every function is a deterministic transform from data to a string, so
 * it is trivial to unit-test and reuse on server or client. The browser-only
 * print step lives in {@link module:print/printer}.
 *
 * ## Why "ESC/POS-ish"?
 * Real ESC/POS is a binary control-code protocol. For a demo / sales asset we
 * emit the *human-readable* equivalent: fixed-width lines sized to a 32- or
 * 48-column roll, centred headers, two-column item rows, and divider rules.
 * The output drops straight into a `<pre>` print window (see printer.ts) and
 * reads exactly like a real kitchen ticket or customer bill. Control bytes are
 * deliberately omitted so the text is portable and copy-pasteable.
 *
 * ## Station routing
 * A kitchen with multiple sections (hot line, cold/salads, bar, dessert) needs
 * each order split so only the relevant lines print at each station. We route
 * by a line's `categoryId` through a configurable {@link StationMap}; lines
 * whose category is unmapped fall to a default station. {@link buildKot} prints
 * one ticket; {@link buildKotsByStation} fans an order out into one ticket per
 * station that actually has items.
 *
 * ## Money convention
 * Amounts are whole-rupee integers in the major unit (e.g. `320` → ₹320),
 * matching {@link module:money} and {@link module:tax}. Formatting here keeps
 * the symbol optional so the monospace columns stay aligned.
 */

import type { OrderLine, OrderRecord } from '../../console/lib/types'
import type { TaxBreakdown } from '../tax'

/** Default character width of a standard 80mm thermal roll. */
export const DEFAULT_WIDTH = 48

/** Character width of a narrow 58mm thermal roll. */
export const NARROW_WIDTH = 32

/**
 * A kitchen station an order line can be routed to. These are conventional
 * labels; the {@link StationMap} decides which `categoryId` maps where.
 */
export type Station = 'hot' | 'cold' | 'bar' | 'dessert' | 'expo'

/**
 * Maps a menu `categoryId` to the {@link Station} that prepares it. Any category
 * not present here routes to {@link KotOptions.defaultStation}.
 */
export type StationMap = Readonly<Record<string, Station>>

/**
 * A reasonable default routing for the seeded demo menu. Categories not listed
 * fall through to the default station (`expo`), so the map never has to be
 * exhaustive. Override per-venue by passing your own {@link StationMap}.
 */
export const DEFAULT_STATION_MAP: StationMap = {
  beverages: 'bar',
  drinks: 'bar',
  cocktails: 'bar',
  appetizers: 'cold',
  starters: 'cold',
  salads: 'cold',
  mains: 'hot',
  'main-course': 'hot',
  curries: 'hot',
  breads: 'hot',
  rice: 'hot',
  tandoor: 'hot',
  desserts: 'dessert',
  dessert: 'dessert',
}

/** Human-readable heading for each station, used in the ticket banner. */
const STATION_LABEL: Readonly<Record<Station, string>> = {
  hot: 'HOT KITCHEN',
  cold: 'COLD / PANTRY',
  bar: 'BAR',
  dessert: 'DESSERT',
  expo: 'EXPO / PASS',
}

/** Options controlling how a kitchen ticket is built. */
export interface KotOptions {
  /** Roll width in characters. Defaults to {@link DEFAULT_WIDTH} (48). */
  width?: number
  /** Category → station routing. Defaults to {@link DEFAULT_STATION_MAP}. */
  stationMap?: StationMap
  /** Station used for unmapped categories. Defaults to `'expo'`. */
  defaultStation?: Station
  /**
   * If set, only lines routed to this station are included (single-station
   * ticket). When omitted, every line is printed on one combined ticket.
   */
  station?: Station
  /** Venue name printed at the top of the ticket. Defaults to `'RELISH'`. */
  venueName?: string
  /**
   * Human-friendly table label (e.g. `'Table 5'`). Falls back to the order's
   * raw `tableId` when omitted.
   */
  tableLabel?: string
  /**
   * Human-friendly server/waiter name. Falls back to the order's raw
   * `waiterId` when omitted.
   */
  waiterName?: string
}

/** Options controlling how a customer receipt is built. */
export interface ReceiptOptions {
  /** Roll width in characters. Defaults to {@link DEFAULT_WIDTH} (48). */
  width?: number
  /** Venue name printed at the top. Defaults to `'RELISH'`. */
  venueName?: string
  /** Optional address / contact lines printed under the venue name. */
  addressLines?: readonly string[]
  /** Optional GSTIN printed in the header. */
  gstin?: string
  /** Bill number (e.g. `'RLB-20260602-0007'`). */
  billNumber?: string
  /** Human-friendly table label. Falls back to the order's `tableId`. */
  tableLabel?: string
  /** Human-friendly server name. Falls back to the order's `waiterId`. */
  waiterName?: string
  /** Tip added on top of the tax breakdown's grand total, in whole rupees. */
  tip?: number
  /** Optional thank-you / footer lines printed at the bottom. */
  footerLines?: readonly string[]
}

/** A consolidated receipt line: a named item, its unit price and quantity. */
export interface ReceiptLine {
  name: string
  price: number
  qty: number
}

/** Coerce arbitrary input to a safe, finite, non-negative integer count. */
function safeQty(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

/** Coerce arbitrary input to a safe, finite, non-negative whole-rupee amount. */
function safeAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/** Clamp a requested roll width into a sane printable range. */
function safeWidth(width: number | undefined): number {
  const w = Number.isFinite(width) ? Math.trunc(width as number) : DEFAULT_WIDTH
  return Math.min(64, Math.max(NARROW_WIDTH, w))
}

/** A full-width horizontal rule of the given character (default `-`). */
function rule(width: number, char = '-'): string {
  return char.repeat(width)
}

/** Centre `text` within `width`, never overflowing (truncates if too long). */
function centre(text: string, width: number): string {
  const trimmed = text.length > width ? text.slice(0, width) : text
  const pad = width - trimmed.length
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + trimmed
}

/**
 * Lay out a left value and a right value on one line of `width`, padding the gap
 * with spaces. If the two would collide, the left side is truncated so the right
 * (usually a price) stays intact and column-aligned.
 */
function row(left: string, right: string, width: number): string {
  const space = width - right.length
  if (space <= 1) {
    return `${left} ${right}`.slice(0, width)
  }
  const leftTrimmed = left.length > space - 1 ? left.slice(0, space - 1) : left
  const gap = width - leftTrimmed.length - right.length
  return leftTrimmed + ' '.repeat(Math.max(1, gap)) + right
}

/**
 * Wrap a long string into lines no wider than `width`, breaking on spaces where
 * possible. Used for item notes/modifiers so they never overflow the roll.
 */
function wrap(text: string, width: number, indent = '  '): string[] {
  const usable = Math.max(1, width - indent.length)
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length === 0) {
      current = word
    } else if (current.length + 1 + word.length <= usable) {
      current = `${current} ${word}`
    } else {
      lines.push(indent + current)
      current = word
    }
  }
  if (current.length > 0) {
    lines.push(indent + current)
  }
  return lines
}

/** Format a whole-rupee amount with the ₹ symbol and en-IN grouping. */
function rupees(amount: number): string {
  return `₹${safeAmount(amount).toLocaleString('en-IN')}`
}

/** Resolve which station a line routes to under the given options. */
function stationFor(
  line: OrderLine,
  stationMap: StationMap,
  defaultStation: Station,
): Station {
  return stationMap[line.categoryId] ?? defaultStation
}

/**
 * Format the order's placed-at timestamp deterministically (local time of the
 * supplied epoch — never reads the clock itself).
 */
function formatStamp(epochMs: number): string {
  const d = new Date(Number.isFinite(epochMs) ? epochMs : 0)
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/**
 * Build a single kitchen order ticket (KOT) as plain monospace text.
 *
 * When `opts.station` is set, only lines routed to that station are printed and
 * the banner names it; otherwise every line is printed on one combined ticket.
 * Lines are routed by `categoryId` through `opts.stationMap`
 * ({@link DEFAULT_STATION_MAP}), with unmapped categories falling to
 * `opts.defaultStation` (`'expo'`). Modifiers and notes print indented under
 * each item, wrapped to the roll width. Prices are intentionally **omitted** —
 * a KOT is for the kitchen, not the customer.
 *
 * Returns an empty string when the order has no lines for the target station,
 * so callers can skip printing empty tickets.
 *
 * @param order The order to ticket.
 * @param opts  Width, routing and label options. See {@link KotOptions}.
 * @returns     The ticket text (newline-separated), or `''` if nothing to print.
 *
 * @example Combined ticket
 *   buildKot(order, { tableLabel: 'Table 5', waiterName: 'Asha' })
 *
 * @example Bar-only ticket
 *   buildKot(order, { station: 'bar' })
 */
export function buildKot(order: OrderRecord, opts: KotOptions = {}): string {
  const width = safeWidth(opts.width)
  const stationMap = opts.stationMap ?? DEFAULT_STATION_MAP
  const defaultStation = opts.defaultStation ?? 'expo'
  const venueName = opts.venueName ?? 'RELISH'

  const lines = order.lines.filter((line) => {
    if (!opts.station) {
      return true
    }
    return stationFor(line, stationMap, defaultStation) === opts.station
  })

  if (lines.length === 0) {
    return ''
  }

  const out: string[] = []
  out.push(centre(venueName, width))
  out.push(centre('*** KITCHEN ORDER ***', width))
  if (opts.station) {
    out.push(centre(STATION_LABEL[opts.station], width))
  }
  out.push(rule(width, '='))
  out.push(row(`Order ${order.id}`, formatStamp(order.placedAt), width))
  out.push(
    row(
      `Table ${opts.tableLabel ?? order.tableId}`,
      `Srv ${opts.waiterName ?? order.waiterId}`,
      width,
    ),
  )
  if (order.source) {
    out.push(`Channel: ${order.source === 'guest' ? 'Guest scan' : 'Staff'}`)
  }
  out.push(rule(width))

  for (const line of lines) {
    const qty = safeQty(line.qty)
    out.push(row(`${qty} x ${line.name}`, '', width).trimEnd())
    if (line.modifiers) {
      out.push(...wrap(`+ ${line.modifiers}`, width))
    }
    if (line.note) {
      out.push(...wrap(`! ${line.note}`, width))
    }
    if (typeof line.seat === 'number') {
      out.push(`  seat ${line.seat}`)
    }
  }

  out.push(rule(width, '='))
  const totalQty = lines.reduce((acc, l) => acc + safeQty(l.qty), 0)
  out.push(row('Items', totalQty.toString(), width))
  return out.join('\n')
}

/**
 * Fan an order out into one {@link buildKot} ticket per station that actually
 * has items, keyed by station. Stations with no matching lines are omitted, so
 * the result only contains tickets worth printing.
 *
 * @param order The order to route.
 * @param opts  Routing/label options (the `station` field is ignored here).
 * @returns     A `Partial<Record<Station, string>>` of station → ticket text.
 *
 * @example
 *   const tickets = buildKotsByStation(order)
 *   // { hot: '…', bar: '…' }  — print each at its station
 */
export function buildKotsByStation(
  order: OrderRecord,
  opts: KotOptions = {},
): Partial<Record<Station, string>> {
  const stationMap = opts.stationMap ?? DEFAULT_STATION_MAP
  const defaultStation = opts.defaultStation ?? 'expo'

  const stations = new Set<Station>()
  for (const line of order.lines) {
    stations.add(stationFor(line, stationMap, defaultStation))
  }

  const result: Partial<Record<Station, string>> = {}
  for (const station of stations) {
    const ticket = buildKot(order, { ...opts, station })
    if (ticket.length > 0) {
      result[station] = ticket
    }
  }
  return result
}

/**
 * Consolidate the lines of one or more orders into a single de-duplicated list
 * for a customer bill, summing quantities of identical items (same name + unit
 * price). Insertion order is preserved so the receipt reads predictably.
 *
 * @param orders Orders whose lines to merge.
 * @returns      Consolidated {@link ReceiptLine}s.
 */
export function consolidateForReceipt(
  orders: readonly OrderRecord[],
): ReceiptLine[] {
  const byKey = new Map<string, ReceiptLine>()
  for (const order of orders) {
    for (const line of order.lines) {
      const key = `${line.name}@${line.price}`
      const existing = byKey.get(key)
      byKey.set(
        key,
        existing
          ? { ...existing, qty: existing.qty + safeQty(line.qty) }
          : { name: line.name, price: line.price, qty: safeQty(line.qty) },
      )
    }
  }
  return [...byKey.values()]
}

/**
 * Build a customer bill / receipt as plain monospace text.
 *
 * Renders the venue header (name, optional address/GSTIN), a per-item table
 * with `qty x name … line-total`, then the tax breakdown supplied by
 * {@link module:tax} (sub-total, each GST component, tax total), an optional
 * tip, and the grand total. All amounts are whole-rupee. The function does not
 * compute tax — pass a {@link TaxBreakdown} from `computeBillTax` /
 * `computeLineItemsTax` so the receipt and the rest of the app agree exactly.
 *
 * @param lines    Consolidated receipt lines (see {@link consolidateForReceipt}).
 * @param tax      The tax breakdown for the bill (sub-total + components).
 * @param opts     Header/footer, bill number, tip and width options.
 * @returns        The receipt text, newline-separated.
 *
 * @example
 *   const tax = computeBillTax(subtotal)
 *   buildReceiptText(lines, tax, { billNumber: 'RLB-20260602-0007', tip: 50 })
 */
export function buildReceiptText(
  lines: readonly ReceiptLine[],
  tax: Readonly<TaxBreakdown>,
  opts: ReceiptOptions = {},
): string {
  const width = safeWidth(opts.width)
  const venueName = opts.venueName ?? 'RELISH'

  const out: string[] = []
  out.push(centre(venueName, width))
  for (const addr of opts.addressLines ?? []) {
    out.push(centre(addr, width))
  }
  if (opts.gstin) {
    out.push(centre(`GSTIN: ${opts.gstin}`, width))
  }
  out.push(centre('TAX INVOICE', width))
  out.push(rule(width, '='))

  if (opts.billNumber) {
    out.push(`Bill: ${opts.billNumber}`)
  }
  if (opts.tableLabel) {
    out.push(`Table: ${opts.tableLabel}`)
  }
  if (opts.waiterName) {
    out.push(`Server: ${opts.waiterName}`)
  }
  out.push(rule(width))

  // Item table.
  out.push(row('Item', 'Amount', width))
  out.push(rule(width))
  for (const line of lines) {
    const qty = safeQty(line.qty)
    const lineTotal = safeAmount(line.price) * qty
    out.push(row(`${qty} x ${line.name}`, rupees(lineTotal), width))
    if (qty > 1) {
      out.push(`    @ ${rupees(line.price)} each`)
    }
  }
  out.push(rule(width))

  // Totals block (driven by the tax engine, not recomputed here).
  out.push(row('Sub-total', rupees(tax.taxableBase), width))
  for (const component of tax.components) {
    out.push(
      row(`${component.label} ${component.pct}%`, rupees(component.amount), width),
    )
  }
  out.push(row('Tax total', rupees(tax.taxTotal), width))

  const tip = safeAmount(opts.tip ?? 0)
  let grandTotal = safeAmount(tax.grandTotal)
  if (tip > 0) {
    out.push(row('Tip', rupees(tip), width))
    grandTotal += tip
  }
  out.push(rule(width, '='))
  out.push(row('TOTAL', rupees(grandTotal), width))
  out.push(rule(width, '='))

  for (const footer of opts.footerLines ?? ['Thank you — see you again!']) {
    out.push(centre(footer, width))
  }
  return out.join('\n')
}
