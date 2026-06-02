// Supabase-backed data layer for guest feedback (Phase 0 ops spine).
//
// Mirrors the feedback shapes in src/data/opsSeed.ts and the feedback handling
// in src/console/store/useOpsStore.tsx, but reads and writes real rows when
// Supabase is configured.
//
// Domain type (Feedback) is reused from ./types; the only translation here is
// the snake_case row <-> camelCase mapping and the epoch-ms <-> ISO timestamp
// mapping for created_at.

import { supabase } from '../../lib/supabase'
import type { Feedback } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface FeedbackRow {
  id: string
  restaurant_id: string
  rating: number
  comment: string | null
  table_id: string | null
  routed_to_public: boolean
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

const COLUMNS = 'id,restaurant_id,rating,comment,table_id,routed_to_public,created_at'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
function rowToFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    rating: row.rating,
    ...(row.comment !== null ? { comment: row.comment } : {}),
    ...(row.table_id !== null ? { tableId: row.table_id } : {}),
    createdAt: isoToMs(row.created_at),
    routedToPublic: row.routed_to_public,
  }
}

function feedbackInsert(restaurantId: string, f: Feedback) {
  return {
    id: f.id,
    restaurant_id: restaurantId,
    rating: f.rating,
    comment: f.comment ?? null,
    table_id: f.tableId ?? null,
    routed_to_public: f.routedToPublic,
    created_at: msToIso(f.createdAt),
  }
}

// ── listFeedback ─────────────────────────────────────────────────────────────
/** Read every feedback entry (newest first), mapped to Feedback. */
export async function listFeedback(restaurantId: string): Promise<Feedback[]> {
  const db = client()
  const { data, error } = await db
    .from('feedback')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as FeedbackRow[]).map(rowToFeedback)
}

// ── createFeedback ───────────────────────────────────────────────────────────
/** Insert a new feedback entry. */
export async function createFeedback(
  restaurantId: string,
  f: Feedback,
): Promise<Feedback> {
  const db = client()
  const { error } = await db.from('feedback').insert(feedbackInsert(restaurantId, f))
  if (error) throw new Error(error.message)
  return f
}
