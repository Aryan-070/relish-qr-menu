// Supabase-backed data layer for the floor tables (Phase 0 ops spine).
//
// Mirrors the table reducers in src/console/store/useOpsStore.tsx
// (SET_TABLE_STATUS / ASSIGN_WAITER / SEAT_TABLE / CLEAR_TABLE) and the seed
// builder in src/data/opsSeed.ts (buildTables), but reads and writes real rows
// when Supabase is configured.
//
// Domain type (Table) is reused from ./types; the only translation here is the
// snake_case row <-> camelCase mapping and the epoch-ms <-> ISO timestamp
// mapping for seated_at.

import { supabase } from '../../lib/supabase'
import type { Table, TableStatus, Zone } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface TableRow {
  id: string
  restaurant_id: string
  label: string
  seats: number
  zone: string
  status: string
  waiter_id: string | null
  guests: number
  seated_at: string | null // ISO timestamptz
}

// ── Time mapping helpers ────────────────────────────────────────────────────
const isoToMs = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)
const msToIso = (ms: number | null): string | null =>
  ms === null ? null : new Date(ms).toISOString()

// ── Guard ────────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const COLUMNS = 'id,restaurant_id,label,seats,zone,status,waiter_id,guests,seated_at'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// zone/status are stored as text; the DB only ever holds values produced by the
// app, so we assert them back into their unions on read.
function rowToTable(row: TableRow): Table {
  return {
    id: row.id,
    label: row.label,
    seats: row.seats,
    zone: row.zone as Zone,
    status: row.status as TableStatus,
    waiterId: row.waiter_id,
    guests: row.guests,
    seatedAt: isoToMs(row.seated_at),
  }
}

// ── listTables ───────────────────────────────────────────────────────────────
/** Read every table for a restaurant, ordered by id, mapped to Table. */
export async function listTables(restaurantId: string): Promise<Table[]> {
  const db = client()
  const { data, error } = await db
    .from('restaurant_tables')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as TableRow[]).map(rowToTable)
}

// ── setStatus ────────────────────────────────────────────────────────────────
/** Mirror SET_TABLE_STATUS: set a table's status. */
export async function setStatus(
  restaurantId: string,
  tableId: string,
  status: TableStatus,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('restaurant_tables')
    .update({ status })
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
  if (error) throw new Error(error.message)
}

// ── assignWaiter ─────────────────────────────────────────────────────────────
/** Mirror ASSIGN_WAITER: set (or clear) a table's waiter. */
export async function assignWaiter(
  restaurantId: string,
  tableId: string,
  waiterId: string | null,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('restaurant_tables')
    .update({ waiter_id: waiterId })
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
  if (error) throw new Error(error.message)
}

// ── seat ─────────────────────────────────────────────────────────────────────
/**
 * Mirror SEAT_TABLE: status -> 'seated', set guests + seated_at (now), and
 * optionally reassign the waiter. When `waiterId` is undefined the existing
 * assignment is left untouched (matching the reducer's `!== undefined` guard).
 */
export async function seat(
  restaurantId: string,
  tableId: string,
  guests: number,
  waiterId?: string | null,
): Promise<void> {
  const db = client()
  const patch: {
    status: TableStatus
    guests: number
    seated_at: string | null
    waiter_id?: string | null
  } = {
    status: 'seated',
    guests,
    seated_at: msToIso(Date.now()),
  }
  if (waiterId !== undefined) patch.waiter_id = waiterId

  const { error } = await db
    .from('restaurant_tables')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
  if (error) throw new Error(error.message)
}

// ── clear ────────────────────────────────────────────────────────────────────
/** Mirror CLEAR_TABLE: status -> 'available', reset guests + seated_at. */
export async function clear(restaurantId: string, tableId: string): Promise<void> {
  const db = client()
  const { error } = await db
    .from('restaurant_tables')
    .update({ status: 'available', guests: 0, seated_at: null })
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
  if (error) throw new Error(error.message)
}
