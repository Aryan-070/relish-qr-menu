/**
 * Minimal typed fetch client for the Django/DRF backend.
 *
 * This is the seam the whole frontend→Django rewire hangs off. It centralises
 * the base URL, JSON encode/decode, error shape, and the two auth mechanisms:
 *   - guest traffic carries an opaque `X-Device-Token` (per dining session);
 *   - staff traffic carries a `Bearer` JWT (read from localStorage for now,
 *     until the console auth rewire owns it).
 *
 * It deliberately has no React/React-Query dependency so it can be called from
 * hooks, tests, or plain modules.
 */

/** Base URL for the API, e.g. `http://localhost:8000/api`. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:8000/api'

/** WebSocket base, e.g. `ws://localhost:8000`. Derived from the API base
 * (swap http→ws, drop the trailing `/api`) unless VITE_WS_BASE_URL overrides. */
export function wsBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (explicit) return explicit.replace(/\/+$/, '')
  return API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '')
}

/** localStorage key the staff JWT is stashed under (set by the console auth). */
const STAFF_TOKEN_KEY = 'relish.staff.jwt'

export interface ApiErrorBody {
  detail?: string
  code?: string
  [key: string]: unknown
}

/** Thrown on any non-2xx response; carries the status and parsed body. */
export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody, fallback: string) {
    super(body?.detail ?? fallback)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function getStaffToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STAFF_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStaffToken(token: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (token) window.localStorage.setItem(STAFF_TOKEN_KEY, token)
    else window.localStorage.removeItem(STAFF_TOKEN_KEY)
  } catch {
    // Storage unavailable — degrade silently.
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** JSON body — serialised automatically. */
  body?: unknown
  /** Guest device token → sent as `X-Device-Token`. */
  deviceToken?: string | null
  /** Force-attach the staff JWT (defaults to whatever is in storage). */
  staff?: boolean
  /** Idempotency key → sent as `Idempotency-Key` (order submission). */
  idempotencyKey?: string
  signal?: AbortSignal
}

/**
 * Perform a request and return the parsed JSON body (typed as `T`).
 * Throws {@link ApiError} on a non-2xx response.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, deviceToken, staff = true, idempotencyKey, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (deviceToken) headers['X-Device-Token'] = deviceToken
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  if (staff) {
    const token = getStaffToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 204) return undefined as T

  let parsed: unknown = null
  const text = await response.text()
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { detail: text }
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (parsed as ApiErrorBody) ?? {},
      `Request to ${path} failed (${response.status}).`,
    )
  }

  return parsed as T
}
