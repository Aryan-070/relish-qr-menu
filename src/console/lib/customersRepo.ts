// Supabase-backed data layer for loyalty/CRM customers (Phase 0 ops spine).
//
// Mirrors the customer shapes in src/data/opsSeed.ts and the CRM handling in
// src/console/store/useOpsStore.tsx, but reads and writes real rows when
// Supabase is configured.
//
// Domain type (Customer) is reused from ./types; the only translation here is
// the snake_case row <-> camelCase mapping and the epoch-ms <-> ISO timestamp
// mapping for last_visit (nullable) and joined_at.

import { supabase } from '../../lib/supabase'
import type { Customer, LoyaltyTier } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface CustomerRow {
  id: string
  restaurant_id: string
  name: string
  phone: string
  points: number
  tier: string
  visits: number
  lifetime_spend: number
  tags: string[]
  last_visit: string | null // ISO timestamptz
  joined_at: string // ISO timestamptz
}

// ── Time mapping helpers ────────────────────────────────────────────────────
const isoToMs = (iso: string): number => Date.parse(iso)
const isoToMsNullable = (iso: string | null): number | null =>
  iso ? Date.parse(iso) : null
const msToIso = (ms: number): string => new Date(ms).toISOString()

// ── Guard ────────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const COLUMNS =
  'id,restaurant_id,name,phone,points,tier,visits,lifetime_spend,tags,last_visit,joined_at'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// tier is stored as text; the DB only ever holds values produced by the app, so
// we assert it back into its union on read. last_visit may be null in the DB;
// the domain coerces it to 0 (epoch) when absent.
function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    points: row.points,
    tier: row.tier as LoyaltyTier,
    visits: row.visits,
    lifetimeSpend: row.lifetime_spend,
    tags: row.tags,
    lastVisit: isoToMsNullable(row.last_visit) ?? 0,
    joinedAt: isoToMs(row.joined_at),
  }
}

function customerInsert(restaurantId: string, c: Customer) {
  return {
    id: c.id,
    restaurant_id: restaurantId,
    name: c.name,
    phone: c.phone,
    points: c.points,
    tier: c.tier,
    visits: c.visits,
    lifetime_spend: c.lifetimeSpend,
    tags: c.tags,
    last_visit: c.lastVisit ? msToIso(c.lastVisit) : null,
    joined_at: msToIso(c.joinedAt),
  }
}

// ── listCustomers ────────────────────────────────────────────────────────────
/** Read every customer (newest first by created/join time), mapped to Customer. */
export async function listCustomers(restaurantId: string): Promise<Customer[]> {
  const db = client()
  const { data, error } = await db
    .from('customers')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('joined_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CustomerRow[]).map(rowToCustomer)
}

// ── createCustomer ───────────────────────────────────────────────────────────
/** Insert a new customer. */
export async function createCustomer(
  restaurantId: string,
  c: Customer,
): Promise<Customer> {
  const db = client()
  const { error } = await db.from('customers').insert(customerInsert(restaurantId, c))
  if (error) throw new Error(error.message)
  return c
}

// ── updateCustomer ───────────────────────────────────────────────────────────
/**
 * Patch a customer. Only the provided camelCase keys are mapped to their
 * snake_case columns, so callers can update a subset of fields.
 */
export async function updateCustomer(
  restaurantId: string,
  id: string,
  patch: Partial<Customer>,
): Promise<void> {
  const db = client()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.phone !== undefined) update.phone = patch.phone
  if (patch.points !== undefined) update.points = patch.points
  if (patch.tier !== undefined) update.tier = patch.tier
  if (patch.visits !== undefined) update.visits = patch.visits
  if (patch.lifetimeSpend !== undefined) update.lifetime_spend = patch.lifetimeSpend
  if (patch.tags !== undefined) update.tags = patch.tags
  if (patch.lastVisit !== undefined)
    update.last_visit = patch.lastVisit ? msToIso(patch.lastVisit) : null
  if (patch.joinedAt !== undefined) update.joined_at = msToIso(patch.joinedAt)

  const { error } = await db
    .from('customers')
    .update(update)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── adjustPoints ─────────────────────────────────────────────────────────────
/** Set a customer's loyalty points and tier in one update. */
export async function adjustPoints(
  restaurantId: string,
  id: string,
  points: number,
  tier: string,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('customers')
    .update({ points, tier })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
