// Supabase-backed data layer for staff (Phase 0 ops spine).
//
// Mirrors the staff shapes in src/data/opsSeed.ts and the staff handling in
// src/console/store/useOpsStore.tsx, but reads and writes real rows when
// Supabase is configured.
//
// Domain type (Staff) is reused from ./types; the only translation here is the
// snake_case row <-> camelCase mapping. Staff carries no timestamps.

import { supabase } from '../../lib/supabase'
import type { Role, Staff } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface StaffRow {
  id: string
  restaurant_id: string
  name: string
  role: string
  shift: string // 'AM' | 'PM'
  hue: number
}

// ── Guard ────────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const COLUMNS = 'id,restaurant_id,name,role,shift,hue'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// role/shift are stored as text; the DB only ever holds values produced by the
// app, so we assert them back into their unions on read.
function rowToStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    name: row.name,
    role: row.role as Role,
    shift: row.shift as 'AM' | 'PM',
    hue: row.hue,
  }
}

function staffInsert(restaurantId: string, s: Staff) {
  return {
    id: s.id,
    restaurant_id: restaurantId,
    name: s.name,
    role: s.role,
    shift: s.shift,
    hue: s.hue,
  }
}

// ── listStaff ────────────────────────────────────────────────────────────────
/** Read every staff member for a restaurant, ordered by id, mapped to Staff. */
export async function listStaff(restaurantId: string): Promise<Staff[]> {
  const db = client()
  const { data, error } = await db
    .from('staff')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as StaffRow[]).map(rowToStaff)
}

// ── createStaff ──────────────────────────────────────────────────────────────
/** Insert a new staff member. */
export async function createStaff(restaurantId: string, s: Staff): Promise<Staff> {
  const db = client()
  const { error } = await db.from('staff').insert(staffInsert(restaurantId, s))
  if (error) throw new Error(error.message)
  return s
}

// ── updateStaff ──────────────────────────────────────────────────────────────
/** Update an existing staff member's editable fields. */
export async function updateStaff(restaurantId: string, s: Staff): Promise<Staff> {
  const db = client()
  const { error } = await db
    .from('staff')
    .update({ name: s.name, role: s.role, shift: s.shift, hue: s.hue })
    .eq('restaurant_id', restaurantId)
    .eq('id', s.id)
  if (error) throw new Error(error.message)
  return s
}

// ── deleteStaff ──────────────────────────────────────────────────────────────
/** Delete a staff member. */
export async function deleteStaff(restaurantId: string, id: string): Promise<void> {
  const db = client()
  const { error } = await db
    .from('staff')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
