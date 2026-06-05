/**
 * Django-backed password-change-with-approval API.
 *  - a waiter opens a request for themselves (`request`),
 *  - an admin/manager lists pending requests and approves/rejects them.
 * All calls carry the staff JWT (apiFetch).
 */
import { apiFetch } from '../../lib/api/client'

export interface PasswordRequest {
  id: string
  requester: string
  requester_name: string
  requester_username: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string
  created_at: string
  reviewed_at: string | null
}

/** Waiter self-service: open a password-change request. */
export async function requestPasswordChange(newPassword: string): Promise<PasswordRequest> {
  return apiFetch<PasswordRequest>('/auth/staff/password/request/', {
    method: 'POST',
    body: { new_password: newPassword },
  })
}

/** Admin/manager: list pending requests in the caller's org. */
export async function listPasswordRequests(): Promise<PasswordRequest[]> {
  const res = await apiFetch<PasswordRequest[]>('/auth/staff/password/requests/')
  return Array.isArray(res) ? res : []
}

export async function approvePasswordRequest(id: string): Promise<PasswordRequest> {
  return apiFetch<PasswordRequest>(`/auth/staff/password/requests/${id}/approve/`, {
    method: 'POST',
  })
}

export async function rejectPasswordRequest(id: string, reason = ''): Promise<PasswordRequest> {
  return apiFetch<PasswordRequest>(`/auth/staff/password/requests/${id}/reject/`, {
    method: 'POST',
    body: { reason },
  })
}
