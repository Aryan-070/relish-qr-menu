/**
 * Staff floor service-request queue (ops.ServiceRequest) — the single surface
 * for both guest-raised and floor-raised calls. `GET /ops/requests/` returns the
 * active queue (pending + claimed); claim/resolve advance the lifecycle.
 */
import { apiFetch } from '../../lib/api/client'

export type ServiceRequestType = 'waiter' | 'water' | 'bill' | 'assistance' | 'cleanup'

export interface FloorServiceRequest {
  id: string
  code: string
  table: string
  type: ServiceRequestType
  status: 'pending' | 'claimed' | 'resolved'
  note: string
  created_at: string
}

interface Paginated<T> {
  results?: T[]
}

export async function listServiceRequests(): Promise<FloorServiceRequest[]> {
  const res = await apiFetch<Paginated<FloorServiceRequest> | FloorServiceRequest[]>(
    '/ops/requests/',
  )
  return Array.isArray(res) ? res : res.results ?? []
}

export function claimServiceRequest(id: string): Promise<FloorServiceRequest> {
  return apiFetch<FloorServiceRequest>(`/ops/requests/${id}/claim/`, { method: 'POST' })
}

export function resolveServiceRequest(id: string): Promise<FloorServiceRequest> {
  return apiFetch<FloorServiceRequest>(`/ops/requests/${id}/resolve/`, { method: 'POST' })
}
