// Supabase-backed data layer for reservations (Phase 0 ops spine).
//
// Mirrors the reservation shapes in src/data/opsSeed.ts and the reservation
// handling in src/console/store/useOpsStore.tsx, but reads and writes real rows
// when Supabase is configured.
//
// Domain type (Reservation) is reused from ./types; the only translation here is
// the snake_case row <-> camelCase mapping and the epoch-ms <-> ISO timestamp
// mapping for at and created_at.

import { supabase } from '../../lib/supabase'
import type { Reservation, ReservationStatus } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface ReservationRow {
  id: string
  restaurant_id: string
  name: string
  phone: string
  party_size: number
  at: string // ISO timestamptz
  table_id: string | null
  status: string
  notes: string | null
  created_at: string // ISO timestamptz
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

const COLUMNS =
  'id,restaurant_id,name,phone,party_size,at,table_id,status,notes,created_at'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// status is stored as text; the DB only ever holds values produced by the app,
// so we assert it back into its union on read.
function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    partySize: row.party_size,
    at: isoToMs(row.at),
    tableId: row.table_id,
    status: row.status as ReservationStatus,
    ...(row.notes !== null ? { notes: row.notes } : {}),
    createdAt: isoToMs(row.created_at),
  }
}

function reservationInsert(restaurantId: string, r: Reservation) {
  return {
    id: r.id,
    restaurant_id: restaurantId,
    name: r.name,
    phone: r.phone,
    party_size: r.partySize,
    at: msToIso(r.at),
    table_id: r.tableId,
    status: r.status,
    notes: r.notes ?? null,
    created_at: msToIso(r.createdAt),
  }
}

// ── listReservations ─────────────────────────────────────────────────────────
/** Read every reservation, ordered by booked time ascending, mapped to domain. */
export async function listReservations(restaurantId: string): Promise<Reservation[]> {
  const db = client()
  const { data, error } = await db
    .from('reservations')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ReservationRow[]).map(rowToReservation)
}

// ── createReservation ────────────────────────────────────────────────────────
/** Insert a new reservation. */
export async function createReservation(
  restaurantId: string,
  r: Reservation,
): Promise<Reservation> {
  const db = client()
  const { error } = await db
    .from('reservations')
    .insert(reservationInsert(restaurantId, r))
  if (error) throw new Error(error.message)
  return r
}

// ── setReservationStatus ─────────────────────────────────────────────────────
/** Update a reservation's status. */
export async function setReservationStatus(
  restaurantId: string,
  id: string,
  status: ReservationStatus,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('reservations')
    .update({ status })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── seatReservation ──────────────────────────────────────────────────────────
/** Seat a reservation: status -> 'seated', assign the table. */
export async function seatReservation(
  restaurantId: string,
  id: string,
  tableId: string,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('reservations')
    .update({ status: 'seated', table_id: tableId })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
