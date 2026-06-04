/**
 * Django-backed CRM customers + loyalty (`/api/crm/customers/`). Maps the
 * org-scoped Customer (paise lifetime spend, ISO timestamps, service-managed
 * tier/points) to the admin shape the Loyalty view uses (rupees, epoch ms).
 * earn/redeem append to the loyalty ledger server-side; redeem rejects an
 * over-draw with HTTP 400 (see `isInsufficientBalance`). All calls carry the
 * staff JWT (apiFetch).
 */
import { ApiError, apiFetch } from '../../lib/api/client'
import type { LoyaltyTier } from '../lib/types'

interface CustomerRow {
  id: string
  name: string
  phone: string
  tier: LoyaltyTier
  points: number
  visits: number
  lifetime_spend_minor: number
  tags: string[]
  last_visit: string | null
  joined_at: string
}

export interface AdminCustomer {
  id: string
  name: string
  phone: string
  tier: LoyaltyTier
  points: number
  visits: number
  /** Rupees (backend stores paise). */
  lifetimeSpend: number
  tags: string[]
  /** Epoch ms, or null if never seen. */
  lastVisit: number | null
  joinedAt: number
}

function rowToCustomer(r: CustomerRow): AdminCustomer {
  return {
    id: r.id,
    name: r.name ?? '',
    phone: r.phone ?? '',
    tier: r.tier,
    points: r.points ?? 0,
    visits: r.visits ?? 0,
    lifetimeSpend: Math.round((r.lifetime_spend_minor ?? 0) / 100),
    tags: r.tags ?? [],
    lastVisit: r.last_visit ? Date.parse(r.last_visit) : null,
    joinedAt: Date.parse(r.joined_at),
  }
}

interface Paginated<T> {
  results?: T[]
  count?: number
}

const ALL = '?limit=500'

export async function listCustomers(): Promise<AdminCustomer[]> {
  const res = await apiFetch<Paginated<CustomerRow> | CustomerRow[]>(`/crm/customers/${ALL}`)
  const rows = Array.isArray(res) ? res : res.results ?? []
  return rows.map(rowToCustomer)
}

export async function earnPoints(id: string, points: number): Promise<AdminCustomer> {
  const row = await apiFetch<CustomerRow>(`/crm/customers/${id}/earn/`, { method: 'POST', body: { points } })
  return rowToCustomer(row)
}

export async function redeemPoints(id: string, points: number): Promise<AdminCustomer> {
  const row = await apiFetch<CustomerRow>(`/crm/customers/${id}/redeem/`, { method: 'POST', body: { points } })
  return rowToCustomer(row)
}

/** Enroll by phone (idempotent — returns the existing member if already enrolled). */
export async function enrollCustomer(phone: string, name?: string): Promise<AdminCustomer> {
  const row = await apiFetch<CustomerRow>('/crm/customers/', {
    method: 'POST',
    body: { phone, name: name ?? '' },
  })
  return rowToCustomer(row)
}

/** True when a redeem was rejected for an insufficient points balance. */
export function isInsufficientBalance(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400
}
