// Supabase-backed data layer for the waitlist (Phase 0 ops spine).
//
// Mirrors the waitlist shapes in src/data/opsSeed.ts and the waitlist handling
// in src/console/store/useOpsStore.tsx, but reads and writes real rows when
// Supabase is configured.
//
// Domain type (WaitlistEntry) is reused from ./types; the only translation here
// is the snake_case row <-> camelCase mapping and the epoch-ms <-> ISO timestamp
// mapping for added_at.

import { supabase } from '../../lib/supabase'
import type { WaitlistEntry, WaitStatus } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface WaitlistRow {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  party_size: number
  quoted_mins: number
  status: string
  added_at: string // ISO timestamptz
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

const COLUMNS = 'id,restaurant_id,name,phone,party_size,quoted_mins,status,added_at'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// status is stored as text; the DB only ever holds values produced by the app,
// so we assert it back into its union on read.
function rowToWaitlistEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    name: row.name,
    ...(row.phone !== null ? { phone: row.phone } : {}),
    partySize: row.party_size,
    quotedMins: row.quoted_mins,
    status: row.status as WaitStatus,
    addedAt: isoToMs(row.added_at),
  }
}

function waitlistInsert(restaurantId: string, w: WaitlistEntry) {
  return {
    id: w.id,
    restaurant_id: restaurantId,
    name: w.name,
    phone: w.phone ?? null,
    party_size: w.partySize,
    quoted_mins: w.quotedMins,
    status: w.status,
    added_at: msToIso(w.addedAt),
  }
}

// ── listWaitlist ─────────────────────────────────────────────────────────────
/** Read every waitlist entry, ordered by added time ascending, mapped to domain. */
export async function listWaitlist(restaurantId: string): Promise<WaitlistEntry[]> {
  const db = client()
  const { data, error } = await db
    .from('waitlist')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('added_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as WaitlistRow[]).map(rowToWaitlistEntry)
}

// ── createWaitlistEntry ──────────────────────────────────────────────────────
/** Insert a new waitlist entry. */
export async function createWaitlistEntry(
  restaurantId: string,
  w: WaitlistEntry,
): Promise<WaitlistEntry> {
  const db = client()
  const { error } = await db.from('waitlist').insert(waitlistInsert(restaurantId, w))
  if (error) throw new Error(error.message)
  return w
}

// ── setWaitStatus ────────────────────────────────────────────────────────────
/** Update a waitlist entry's status. */
export async function setWaitStatus(
  restaurantId: string,
  id: string,
  status: WaitStatus,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('waitlist')
    .update({ status })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── removeWaitlistEntry ──────────────────────────────────────────────────────
/** Delete a waitlist entry. */
export async function removeWaitlistEntry(
  restaurantId: string,
  id: string,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('waitlist')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
