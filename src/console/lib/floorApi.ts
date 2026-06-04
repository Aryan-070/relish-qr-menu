/**
 * Django-backed floor admin (`/api/ops/tables/`). Maps between the backend
 * RestaurantTable (snake_case, membership UUID, ISO `seated_at`, optimistic
 * `version`) and a compact admin shape the Floor view uses. The seat/clear/
 * set-status custom actions encode the floor state machine; a stale `version`
 * is rejected with HTTP 409 (see `isConflict`). All calls carry the staff JWT.
 */
import { ApiError, apiFetch } from '../../lib/api/client'
import type { TableStatus, Zone } from '../lib/types'

interface TableRow {
  id: string
  code: string
  label: string
  seats: number
  zone: Zone
  status: TableStatus
  waiter_membership: string | null
  guests: number
  seated_at: string | null
  version: number
}

export interface AdminTable {
  id: string
  code: string
  label: string
  seats: number
  zone: Zone
  status: TableStatus
  waiterMembershipId: string | null
  guests: number
  /** Epoch ms when last seated, or null. */
  seatedAt: number | null
  version: number
}

function rowToTable(r: TableRow): AdminTable {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    seats: r.seats ?? 0,
    zone: r.zone,
    status: r.status,
    waiterMembershipId: r.waiter_membership,
    guests: r.guests ?? 0,
    seatedAt: r.seated_at ? Date.parse(r.seated_at) : null,
    version: r.version ?? 1,
  }
}

interface Paginated<T> {
  results?: T[]
  count?: number
}

const ALL = '?limit=500'

export async function listTables(): Promise<AdminTable[]> {
  const res = await apiFetch<Paginated<TableRow> | TableRow[]>(`/ops/tables/${ALL}`)
  const rows = Array.isArray(res) ? res : res.results ?? []
  return rows.map(rowToTable)
}

/** Draft fields the create-table form supplies (no id/version/status). */
export interface TableDraft {
  code: string
  label: string
  seats: number
  zone: Zone
}

export async function createTable(draft: TableDraft): Promise<AdminTable> {
  const row = await apiFetch<TableRow>('/ops/tables/', {
    method: 'POST',
    body: { code: draft.code, label: draft.label, seats: draft.seats, zone: draft.zone, status: 'available', guests: 0 },
  })
  return rowToTable(row)
}

export async function seatTable(
  id: string,
  version: number,
  guests: number,
  waiterMembershipId?: string | null,
): Promise<AdminTable> {
  const body: Record<string, unknown> = { guests, version }
  if (waiterMembershipId) body.waiter_membership_id = waiterMembershipId
  const row = await apiFetch<TableRow>(`/ops/tables/${id}/seat/`, { method: 'POST', body })
  return rowToTable(row)
}

export async function clearTable(id: string, version: number): Promise<AdminTable> {
  const row = await apiFetch<TableRow>(`/ops/tables/${id}/clear/`, { method: 'POST', body: { version } })
  return rowToTable(row)
}

export async function setTableStatus(id: string, version: number, status: TableStatus): Promise<AdminTable> {
  const row = await apiFetch<TableRow>(`/ops/tables/${id}/set_status/`, { method: 'POST', body: { status, version } })
  return rowToTable(row)
}

/** Reassign (or clear, with null) the waiter via PATCH — carries the version. */
export async function assignWaiter(
  id: string,
  version: number,
  waiterMembershipId: string | null,
): Promise<AdminTable> {
  const row = await apiFetch<TableRow>(`/ops/tables/${id}/`, {
    method: 'PATCH',
    body: { waiter_membership: waiterMembershipId, version },
  })
  return rowToTable(row)
}

/** True when a mutation lost the optimistic-concurrency race (stale version). */
export function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409
}
