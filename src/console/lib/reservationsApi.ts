/**
 * Django-backed reservations (`/api/crm/reservations/`). The Floor view consumes
 * the upcoming subset for its side panel; the future Reservations view reuses the
 * mutations. Maps ISO timestamps → epoch ms and snake_case → camelCase. All calls
 * carry the staff JWT (apiFetch).
 */
import { apiFetch } from '../../lib/api/client'
import type { ReservationStatus } from '../lib/types'

interface ReservationRow {
  id: string
  customer: string | null
  name: string
  phone: string
  party_size: number
  at: string
  table_id: string | null
  status: ReservationStatus
  notes: string
  created_at: string
  updated_at: string
}

export interface AdminReservation {
  id: string
  customerId: string | null
  name: string
  phone: string
  partySize: number
  /** Booked time, epoch ms. */
  at: number
  tableId: string | null
  status: ReservationStatus
  notes: string
  createdAt: number
}

function rowToReservation(r: ReservationRow): AdminReservation {
  return {
    id: r.id,
    customerId: r.customer,
    name: r.name,
    phone: r.phone ?? '',
    partySize: r.party_size ?? 1,
    at: Date.parse(r.at),
    tableId: r.table_id,
    status: r.status,
    notes: r.notes ?? '',
    createdAt: Date.parse(r.created_at),
  }
}

interface Paginated<T> {
  results?: T[]
  count?: number
}

const ALL = '?limit=500'

export async function listReservations(): Promise<AdminReservation[]> {
  const res = await apiFetch<Paginated<ReservationRow> | ReservationRow[]>(`/crm/reservations/${ALL}`)
  const rows = Array.isArray(res) ? res : res.results ?? []
  return rows.map(rowToReservation)
}
