/**
 * Minimal staff authentication for the floor cockpit: exchange email/password
 * for a JWT and stash the access token where the api client picks it up
 * (`Bearer` on every staff request). No refresh handling yet — on expiry the
 * staff logs in again (tracked for a later increment).
 */
import { apiFetch, getStaffToken, setStaffToken } from './client'

interface TokenResponse {
  access: string
  refresh: string
}

export async function staffLogin(email: string, password: string): Promise<void> {
  const tokens = await apiFetch<TokenResponse>('/auth/token/', {
    method: 'POST',
    body: { email, password },
    staff: false,
  })
  setStaffToken(tokens.access)
}

export function staffLogout(): void {
  setStaffToken(null)
}

export function isStaffAuthed(): boolean {
  return getStaffToken() !== null
}
