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
  username: string | null
  email: string
  role: string
  status: string
  active: boolean
}

export interface AdminStaff {
  id: string
  name: string
  username: string | null
  email: string
  /** Seeded role key: 'admin' | 'manager' | 'waiter' | … */
  role: string
  active: boolean
}

/** Roles an admin/manager can create from the console. */
export type CreatableRole = 'manager' | 'waiter' | 'kitchen' | 'host' | 'admin'

export interface CreateStaffInput {
  username: string
  password: string
  display_name?: string
  role_key: CreatableRole
  outlet_ids?: string[]
  email?: string
}

function rowToStaff(r: MembershipRow): AdminStaff {
  return {
    id: r.id,
    name: r.display_name || r.email || 'Staff',
    username: r.username ?? null,
    email: r.email ?? '',
    role: r.role,
    active: r.active ?? true,
  }
}

export async function listStaff(): Promise<AdminStaff[]> {
  const res = await apiFetch<MembershipRow[]>('/auth/staff/')
  return (Array.isArray(res) ? res : []).map(rowToStaff)
}

/** Create a login-ready staff member (admin/manager only). */
export async function createStaff(input: CreateStaffInput): Promise<AdminStaff> {
  const row = await apiFetch<MembershipRow>('/auth/staff/create/', {
    method: 'POST',
    body: input,
  })
  return rowToStaff(row)
}

/** Suspend a membership (and disable the login if it's their last active one). */
export async function deactivateStaff(id: string): Promise<void> {
  await apiFetch(`/auth/staff/${id}/deactivate/`, { method: 'POST' })
}

/** Reactivate a previously suspended membership. */
export async function reactivateStaff(id: string): Promise<AdminStaff> {
  const row = await apiFetch<MembershipRow>(`/auth/staff/${id}/`, {
    method: 'PATCH',
    body: { active: true },
  })
  return rowToStaff(row)
}

/** Admin/manager direct password reset (no approval flow). */
export async function resetStaffPassword(id: string, newPassword: string): Promise<void> {
  await apiFetch(`/auth/staff/${id}/reset-password/`, {
    method: 'POST',
    body: { new_password: newPassword },
  })
}
