/**
 * Django-backed staff roster (the org's memberships). Powers the Floor view's
 * waiter-assignment dropdown and the avatar name lookup; the future Roster view
 * reuses it. `GET /api/auth/staff/` returns a bare array (not paginated) shaped
 * by MembershipSerializer. All calls carry the staff JWT (apiFetch).
 */
import { apiFetch } from '../../lib/api/client'

interface MembershipRow {
  id: string
  display_name: string
  email: string
  role: string
  status: string
  active: boolean
}

export interface AdminStaff {
  id: string
  name: string
  email: string
  /** Seeded role key: 'admin' | 'manager' | 'waiter' | … */
  role: string
  active: boolean
}

function rowToStaff(r: MembershipRow): AdminStaff {
  return {
    id: r.id,
    name: r.display_name || r.email || 'Staff',
    email: r.email ?? '',
    role: r.role,
    active: r.active ?? true,
  }
}

export async function listStaff(): Promise<AdminStaff[]> {
  const res = await apiFetch<MembershipRow[]>('/auth/staff/')
  return (Array.isArray(res) ? res : []).map(rowToStaff)
}
