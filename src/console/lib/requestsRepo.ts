// Supabase-backed data layer for service requests (Phase 0 ops spine).
//
// Mirrors the request reducers in src/console/store/useOpsStore.tsx
// (claim / resolve) and the seed builder in src/data/opsSeed.ts, but reads and
// writes real rows when Supabase is configured.
//
// Domain type (ServiceRequest) is reused from ./types; the only translation
// here is the snake_case row <-> camelCase mapping and the epoch-ms <-> ISO
// timestamp mapping for created_at.

import { supabase } from '../../lib/supabase'
import type { RequestStatus, RequestType, ServiceRequest } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
interface ServiceRequestRow {
  id: string
  restaurant_id: string
  table_id: string
  type: string
  created_at: string // ISO timestamptz
  status: string
  claimed_by: string | null
  note: string | null
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

const COLUMNS = 'id,restaurant_id,table_id,type,created_at,status,claimed_by,note'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
// type/status are stored as text; the DB only ever holds values produced by the
// app, so we assert them back into their unions on read.
function rowToRequest(row: ServiceRequestRow): ServiceRequest {
  return {
    id: row.id,
    tableId: row.table_id,
    type: row.type as RequestType,
    createdAt: isoToMs(row.created_at),
    status: row.status as RequestStatus,
    claimedBy: row.claimed_by,
    ...(row.note !== null ? { note: row.note } : {}),
  }
}

function requestInsert(restaurantId: string, r: ServiceRequest) {
  return {
    id: r.id,
    restaurant_id: restaurantId,
    table_id: r.tableId,
    type: r.type,
    created_at: msToIso(r.createdAt),
    status: r.status,
    claimed_by: r.claimedBy,
    note: r.note ?? null,
  }
}

// ── listRequests ─────────────────────────────────────────────────────────────
/** Read every service request (newest first), mapped to ServiceRequest. */
export async function listRequests(restaurantId: string): Promise<ServiceRequest[]> {
  const db = client()
  const { data, error } = await db
    .from('service_requests')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ServiceRequestRow[]).map(rowToRequest)
}

// ── createRequest ────────────────────────────────────────────────────────────
/** Insert a new service request. */
export async function createRequest(
  restaurantId: string,
  r: ServiceRequest,
): Promise<ServiceRequest> {
  const db = client()
  const { error } = await db
    .from('service_requests')
    .insert(requestInsert(restaurantId, r))
  if (error) throw new Error(error.message)
  return r
}

// ── claimRequest ─────────────────────────────────────────────────────────────
/** Mirror claim: status -> 'claimed', set claimed_by to the staff member. */
export async function claimRequest(
  restaurantId: string,
  id: string,
  staffId: string,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('service_requests')
    .update({ status: 'claimed', claimed_by: staffId })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── resolveRequest ───────────────────────────────────────────────────────────
/** Mirror resolve: status -> 'resolved'. */
export async function resolveRequest(restaurantId: string, id: string): Promise<void> {
  const db = client()
  const { error } = await db
    .from('service_requests')
    .update({ status: 'resolved' })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
