// Supabase-backed data layer for orders (Phase 0 ops spine).
//
// Mirrors the order shapes in src/data/opsSeed.ts (buildOrders) and the
// PAY_TABLES reducer in src/console/store/useOpsStore.tsx, but reads and writes
// real rows when Supabase is configured. An order is stored as one `orders` row
// plus N `order_lines` rows; this module reassembles them into OrderRecord.
//
// Domain types (OrderRecord / OrderLine) are reused from ./types; the only
// translation here is the snake_case row <-> camelCase mapping and the
// epoch-ms <-> ISO timestamp mapping for placed_at.

import { supabase } from '../../lib/supabase'
import type { OrderLine, OrderRecord } from './types'

// ── DB row shapes ────────────────────────────────────────────────────────────
interface OrderRow {
  id: string
  restaurant_id: string
  table_id: string
  waiter_id: string
  placed_at: string // ISO timestamptz
  total: number
  paid: boolean
  status: string
}

interface OrderLineRow {
  id: string
  restaurant_id: string
  order_id: string
  item_id: string
  name: string
  price: number
  qty: number
  category_id: string
  modifiers: unknown | null
  seat: number | null
}

// ── Time mapping helpers ────────────────────────────────────────────────────
const isoToMs = (iso: string): number => Date.parse(iso)
const msToIso = (ms: number): string => new Date(ms).toISOString()

// ── Guard ────────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ── Row <-> domain mapping ──────────────────────────────────────────────────
function lineRowToLine(row: OrderLineRow): OrderLine {
  return {
    itemId: row.item_id,
    name: row.name,
    price: row.price,
    qty: row.qty,
    categoryId: row.category_id,
  }
}

/** Assemble an OrderRecord from its header row + its line rows. */
function rowsToOrder(order: OrderRow, lines: OrderLineRow[]): OrderRecord {
  return {
    id: order.id,
    tableId: order.table_id,
    waiterId: order.waiter_id,
    placedAt: isoToMs(order.placed_at),
    lines: lines.map(lineRowToLine),
    total: order.total,
    paid: order.paid,
  }
}

/** Header insert payload for an order. status defaults to 'open' when unpaid. */
function orderInsert(restaurantId: string, order: OrderRecord) {
  return {
    id: order.id,
    restaurant_id: restaurantId,
    table_id: order.tableId,
    waiter_id: order.waiterId,
    placed_at: msToIso(order.placedAt),
    total: order.total,
    paid: order.paid,
    status: order.paid ? 'paid' : 'open',
  }
}

/** Line insert payloads for an order's lines. */
function lineInserts(restaurantId: string, orderId: string, lines: OrderLine[]) {
  return lines.map(ln => ({
    restaurant_id: restaurantId,
    order_id: orderId,
    item_id: ln.itemId,
    name: ln.name,
    price: ln.price,
    qty: ln.qty,
    category_id: ln.categoryId,
  }))
}

// ── listOrders ───────────────────────────────────────────────────────────────
/** Read every order (newest first) with its lines, mapped to OrderRecord. */
export async function listOrders(restaurantId: string): Promise<OrderRecord[]> {
  const db = client()

  const { data: orderRows, error: orderErr } = await db
    .from('orders')
    .select('id,restaurant_id,table_id,waiter_id,placed_at,total,paid,status')
    .eq('restaurant_id', restaurantId)
    .order('placed_at', { ascending: false })
  if (orderErr) throw new Error(orderErr.message)
  const orders = (orderRows ?? []) as OrderRow[]
  if (!orders.length) return []

  const { data: lineRows, error: lineErr } = await db
    .from('order_lines')
    .select('id,restaurant_id,order_id,item_id,name,price,qty,category_id,modifiers,seat')
    .eq('restaurant_id', restaurantId)
    .in(
      'order_id',
      orders.map(o => o.id),
    )
  if (lineErr) throw new Error(lineErr.message)

  // Bucket lines by order_id for O(n) assembly.
  const byOrder = new Map<string, OrderLineRow[]>()
  for (const ln of (lineRows ?? []) as OrderLineRow[]) {
    const bucket = byOrder.get(ln.order_id)
    if (bucket) bucket.push(ln)
    else byOrder.set(ln.order_id, [ln])
  }

  return orders.map(o => rowsToOrder(o, byOrder.get(o.id) ?? []))
}

// ── createOrder ──────────────────────────────────────────────────────────────
/**
 * Insert an order header + its lines. Mirrors buildOrders() shape. The header
 * is inserted first so the lines have a parent; if the line insert fails the
 * caller surfaces the error (the header row is left for a retry/cleanup pass).
 */
export async function createOrder(
  restaurantId: string,
  order: OrderRecord,
): Promise<OrderRecord> {
  const db = client()

  const { error: headerErr } = await db
    .from('orders')
    .insert(orderInsert(restaurantId, order))
  if (headerErr) throw new Error(headerErr.message)

  if (order.lines.length) {
    const { error: linesErr } = await db
      .from('order_lines')
      .insert(lineInserts(restaurantId, order.id, order.lines))
    if (linesErr) throw new Error(linesErr.message)
  }

  return order
}

// ── setOrderStatus ───────────────────────────────────────────────────────────
/** Update an order's free-form status (e.g. 'open' | 'paid' | 'void'). */
export async function setOrderStatus(
  restaurantId: string,
  orderId: string,
  status: string,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('orders')
    .update({ status })
    .eq('restaurant_id', restaurantId)
    .eq('id', orderId)
  if (error) throw new Error(error.message)
}

// ── setPaid ──────────────────────────────────────────────────────────────────
/** Flip an order's paid flag, keeping status in sync ('paid' / 'open'). */
export async function setPaid(
  restaurantId: string,
  orderId: string,
  paid: boolean,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('orders')
    .update({ paid, status: paid ? 'paid' : 'open' })
    .eq('restaurant_id', restaurantId)
    .eq('id', orderId)
  if (error) throw new Error(error.message)
}

// ── settleTables ─────────────────────────────────────────────────────────────
/**
 * Mirror PAY_TABLES (orders side): mark every unpaid order on the given tables
 * paid. Returns the ids of the orders that were settled. The table/request side
 * of PAY_TABLES lives in tablesRepo + a future requests repo.
 */
export async function settleTables(
  restaurantId: string,
  tableIds: string[],
): Promise<string[]> {
  const db = client()
  if (!tableIds.length) return []

  const { data, error } = await db
    .from('orders')
    .update({ paid: true, status: 'paid' })
    .eq('restaurant_id', restaurantId)
    .eq('paid', false)
    .in('table_id', tableIds)
    .select('id')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string }[]).map(r => r.id)
}
