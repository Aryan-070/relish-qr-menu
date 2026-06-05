/**
 * Typed bindings for the `/api/dining/` endpoints (the dining-session spine).
 * Mirrors the DRF serializers in `backend/dining/serializers.py`.
 */
import { apiFetch } from './client'

export type OrderConfirmationMode = 'auto_fire' | 'leader' | 'waiter_confirm'
export type SessionStatus = 'open' | 'ordering' | 'bill_requested' | 'closed' | 'abandoned'
export type DeviceRole = 'participant' | 'orderer' | 'leader'

export interface GuestDeviceView {
  id: string
  display_name: string
  role: DeviceRole
  is_payer: boolean
  last_seen: string | null
}

export interface CheckView {
  id: string
  subtotal_minor: number
  tax_minor: number
  service_charge_minor: number
  total_minor: number
  paid_minor: number
  status: 'open' | 'partially_paid' | 'settled' | 'void' | 'disputed'
  liable_customer: string | null
}

export interface SessionOrderLine {
  id: string
  item_name: string
  unit_price_minor: number
  qty: number
}

export interface SessionOrder {
  id: string
  code: string
  status: string
  confirmation: 'draft' | 'pending_confirmation' | 'confirmed'
  total_minor: number
  lines: SessionOrderLine[]
}

export interface DiningSessionView {
  id: string
  table: string
  table_code: string
  table_label: string
  status: SessionStatus
  epoch: number
  order_confirmation_mode: OrderConfirmationMode
  leader_device: string | null
  party_size: number
  opened_at: string
  closed_at: string | null
  version: number
  devices: GuestDeviceView[]
  check: CheckView | null
  orders: SessionOrder[]
  /** The requesting device's own view of itself (null for staff / no token). */
  me: { id: string; role: DeviceRole; is_payer: boolean; has_contact: boolean } | null
  /** Server-authoritative "may this device order?" — the UI mirrors this. */
  can_order: boolean
}

export interface JoinResult {
  session_id: string
  device_token: string
  role: DeviceRole
  epoch: number
  order_confirmation_mode: OrderConfirmationMode
  status: SessionStatus
}

export interface OrderLineInput {
  menu_item_id: string
  qty: number
  modifier_ids?: string[]
  seat?: number | null
  note?: string
}

/** Join (or open) the live session for a table. No auth — mints a device token. */
export function joinSession(input: {
  restaurant_id: string
  table_id: string
  display_name?: string
}): Promise<JoinResult> {
  return apiFetch<JoinResult>('/dining/join/', { method: 'POST', body: input, staff: false })
}

/** Poll the live session snapshot (device token OR staff JWT).
 *  When a device token is present we authenticate as that guest device and must
 *  NOT also send a staff JWT — otherwise the backend treats the poll as staff
 *  (device=None) and reports can_order=false. */
export function getSession(sessionId: string, deviceToken: string | null): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/`, {
    deviceToken,
    staff: deviceToken == null,
  })
}

/** Staff: list the tenant's live dining sessions (the floor cockpit feed). */
export function listSessions(): Promise<{ results: DiningSessionView[] }> {
  return apiFetch<{ results: DiningSessionView[] }>('/dining/sessions/')
}

/** Submit an order as a joined device, honoring the session's policy. */
export function submitSessionOrder(
  sessionId: string,
  deviceToken: string,
  lines: OrderLineInput[],
  idempotencyKey?: string,
): Promise<SessionOrder> {
  return apiFetch<SessionOrder>(`/dining/sessions/${sessionId}/orders/`, {
    method: 'POST',
    body: { lines },
    deviceToken,
    staff: false,
    idempotencyKey,
  })
}

/** Capture contact details → resolve-or-create a CRM customer for the device.
 *  Birthday is day+month only (optional), for marketing automations. */
export function submitContact(
  sessionId: string,
  input: { phone: string; name?: string; birth_day?: number | null; birth_month?: number | null; device_token?: string },
  deviceToken: string | null,
): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/contact/`, {
    method: 'POST',
    body: input,
    deviceToken,
    staff: deviceToken == null,
  })
}

export type ServiceRequestKind = 'waiter' | 'water' | 'bill' | 'assistance' | 'cleanup'

/** The created service request (shape mirrors ops.ServiceRequest). */
export interface ServiceRequestView {
  id: string
  code: string
  table: string
  type: ServiceRequestKind
  status: 'pending' | 'claimed' | 'resolved'
  note: string
  created_at: string
}

/** Guest raises a service request (call waiter / water / bill). It lands on the
 *  shared ops.ServiceRequest queue; staff work it via the ops floor endpoints. */
export function createServiceRequest(
  sessionId: string,
  deviceToken: string,
  kind: ServiceRequestKind,
  note?: string,
): Promise<ServiceRequestView> {
  return apiFetch<ServiceRequestView>(`/dining/sessions/${sessionId}/service-request/`, {
    method: 'POST',
    body: { kind, note },
    deviceToken,
    staff: false,
  })
}

// ── Staff actions (JWT) ───────────────────────────────────────────────────────
/** Staff promotes a device (by its id from the snapshot) to session leader. */
export function promoteDevice(
  sessionId: string,
  deviceId: string,
  version?: number,
): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/promote/`, {
    method: 'POST',
    body: { device_id: deviceId, version },
  })
}

export function confirmOrders(sessionId: string, orderIds: string[]): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/confirm/`, {
    method: 'POST',
    body: { order_ids: orderIds },
  })
}

export function requestBill(sessionId: string, deviceToken: string | null): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/request-bill/`, {
    method: 'POST',
    deviceToken,
    staff: deviceToken == null,
  })
}

export function closeSession(sessionId: string): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/close/`, { method: 'POST' })
}

// ── Payment & liability (Phase 3) ─────────────────────────────────────────────
export interface PayResult {
  order_id: string
  amount_minor: number
  currency: string
}

/** Create a Razorpay order for the session's bill (device or staff). */
export function payCheck(sessionId: string, deviceToken: string | null): Promise<PayResult> {
  return apiFetch<PayResult>(`/dining/sessions/${sessionId}/pay/`, {
    method: 'POST',
    deviceToken,
    staff: deviceToken == null,
  })
}

/** Staff: settle the bill in cash / at the counter (audited). */
export function settleCheckCash(sessionId: string): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/settle-cash/`, {
    method: 'POST',
  })
}

/** Staff: flag the bill disputed (walkout / contested); audited. */
export function disputeCheck(sessionId: string, reason?: string): Promise<DiningSessionView> {
  return apiFetch<DiningSessionView>(`/dining/sessions/${sessionId}/dispute/`, {
    method: 'POST',
    body: { reason },
  })
}
