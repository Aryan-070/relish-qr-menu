/**
 * Staff authentication for the console: exchange a username (or recovery email)
 * + password for a JWT, stash the access token where the api client picks it up
 * (`Bearer` on every staff request), and read the signed-in identity via
 * `/auth/me/`. No refresh handling yet — on expiry the staff logs in again.
 */
import { apiFetch, getStaffToken, setStaffToken } from './client'

interface TokenResponse {
  access: string
  refresh: string
}

/** One membership row as returned inside `/auth/me/`. */
export interface MeMembership {
  membership_id: string
  org_id: string
  org_name: string
  restaurant_id: string | null
  restaurant_name: string | null
  role: string | null
  perms: string[]
}

export interface MeResponse {
  id: string
  username: string
  email: string | null
  memberships: MeMembership[]
  active: MeMembership | null
}

/**
 * Log in with a username OR recovery email. The backend
 * (`UsernameOrEmailBackend`) resolves either against the `username` field.
 */
export async function staffLogin(identifier: string, password: string): Promise<void> {
  const tokens = await apiFetch<TokenResponse>('/auth/token/', {
    method: 'POST',
    body: { username: identifier, password },
    staff: false,
  })
  setStaffToken(tokens.access)
}

/** Fetch the signed-in user + their active membership (role / restaurant / perms). */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me/')
}

export function staffLogout(): void {
  setStaffToken(null)
}

export function isStaffAuthed(): boolean {
  return getStaffToken() !== null
}
