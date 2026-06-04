/**
 * Guest dining-session lifecycle for the QR flow.
 *
 * On a `/qsr?r=<restaurant_id>&t=<table_id>` scan this hook joins (or rejoins)
 * the table's live session, persists the opaque device token in localStorage so
 * a refresh / re-scan returns to the same session, and polls the live snapshot
 * (React Query `refetchInterval`) so role/mode/status/orders stay current
 * without websockets (Phase 4 upgrades this to Channels).
 *
 * The epoch/turnover guard lives server-side: once the table turns over, the
 * stored token stops resolving (401/403), so we drop it and join fresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../lib/api/client'
import {
  closeSession,
  confirmOrders,
  getSession,
  joinSession,
  payCheck,
  promoteDevice,
  requestBill,
  submitContact,
  submitSessionOrder,
  type DeviceRole,
  type DiningSessionView,
  type OrderLineInput,
  type PayResult,
} from '../lib/api/dining'

interface StoredSession {
  sessionId: string
  deviceToken: string
}

const POLL_INTERVAL_MS = 4000

function storageKey(restaurantId: string, tableId: string): string {
  return `relish.dining.${restaurantId}.${tableId}`
}

function readStored(restaurantId: string, tableId: string): StoredSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(restaurantId, tableId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    return parsed?.sessionId && parsed?.deviceToken ? parsed : null
  } catch {
    return null
  }
}

function writeStored(restaurantId: string, tableId: string, value: StoredSession | null): void {
  if (typeof window === 'undefined') return
  try {
    const key = storageKey(restaurantId, tableId)
    if (value) window.localStorage.setItem(key, JSON.stringify(value))
    else window.localStorage.removeItem(key)
  } catch {
    // Storage unavailable — degrade to an in-memory session for this tab.
  }
}

/** Read `r` / `t` from the current URL (the QR carries these). */
export function readSessionParamsFromUrl(): { restaurantId: string; tableId: string } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const restaurantId = params.get('r')
  const tableId = params.get('t')
  if (!restaurantId || !tableId) return null
  return { restaurantId, tableId }
}

export interface UseSessionResult {
  /** True when a QR (r + t) is present — otherwise the surface runs offline. */
  enabled: boolean
  joining: boolean
  joinError: string | null
  session: DiningSessionView | null
  deviceToken: string | null
  role: DeviceRole | null
  canOrder: boolean
  isLeader: boolean
  status: DiningSessionView['status'] | null
  refetch: () => void
  // Guest actions
  submitOrder: (lines: OrderLineInput[], idempotencyKey?: string) => Promise<void>
  captureContact: (phone: string, name?: string) => Promise<void>
  askForBill: () => Promise<void>
  /** Create a Razorpay order for the bill — hand the result to checkout. */
  pay: () => Promise<PayResult>
  // Staff actions (require a staff JWT in storage)
  promote: (deviceToken: string, version?: number) => Promise<void>
  confirm: (orderIds: string[]) => Promise<void>
  endSession: () => Promise<void>
}

export function useSession(params?: { restaurantId: string; tableId: string } | null): UseSessionResult {
  const resolved = useMemo(() => params ?? readSessionParamsFromUrl(), [params])
  const enabled = resolved !== null

  const [stored, setStored] = useState<StoredSession | null>(() =>
    resolved ? readStored(resolved.restaurantId, resolved.tableId) : null,
  )
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const joinInFlight = useRef(false)
  const queryClient = useQueryClient()

  const queryKey = useMemo(() => ['dining-session', stored?.sessionId ?? null], [stored?.sessionId])

  // Join (or rejoin) when we have a QR but no usable stored session.
  const doJoin = useCallback(async () => {
    if (!resolved || joinInFlight.current) return
    joinInFlight.current = true
    setJoining(true)
    setJoinError(null)
    try {
      const result = await joinSession({
        restaurant_id: resolved.restaurantId,
        table_id: resolved.tableId,
      })
      const next: StoredSession = { sessionId: result.session_id, deviceToken: result.device_token }
      writeStored(resolved.restaurantId, resolved.tableId, next)
      setStored(next)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join the table session.')
    } finally {
      setJoining(false)
      joinInFlight.current = false
    }
  }, [resolved])

  useEffect(() => {
    if (enabled && stored === null) void doJoin()
  }, [enabled, stored, doJoin])

  const query = useQuery({
    queryKey,
    queryFn: () => getSession(stored!.sessionId, stored!.deviceToken),
    enabled: enabled && stored !== null,
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  })

  // A stale token (closed/turned-over session) → drop it and join fresh.
  useEffect(() => {
    const error = query.error
    if (error instanceof ApiError && [401, 403, 404].includes(error.status) && resolved) {
      writeStored(resolved.restaurantId, resolved.tableId, null)
      setStored(null)
    }
  }, [query.error, resolved])

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  const session = query.data ?? null
  const deviceToken = stored?.deviceToken ?? null

  // ── Actions (each refreshes the snapshot after mutating) ────────────────────
  const submitOrder = useCallback(
    async (lines: OrderLineInput[], idempotencyKey?: string) => {
      if (!stored) throw new Error('No active session.')
      await submitSessionOrder(stored.sessionId, stored.deviceToken, lines, idempotencyKey)
      refetch()
    },
    [stored, refetch],
  )

  const captureContact = useCallback(
    async (phone: string, name?: string) => {
      if (!stored) throw new Error('No active session.')
      await submitContact(stored.sessionId, { phone, name }, stored.deviceToken)
      refetch()
    },
    [stored, refetch],
  )

  const askForBill = useCallback(async () => {
    if (!stored) throw new Error('No active session.')
    await requestBill(stored.sessionId, stored.deviceToken)
    refetch()
  }, [stored, refetch])

  const pay = useCallback(async (): Promise<PayResult> => {
    if (!stored) throw new Error('No active session.')
    const result = await payCheck(stored.sessionId, stored.deviceToken)
    refetch()
    return result
  }, [stored, refetch])

  const promote = useCallback(
    async (token: string, version?: number) => {
      if (!stored) throw new Error('No active session.')
      await promoteDevice(stored.sessionId, token, version)
      refetch()
    },
    [stored, refetch],
  )

  const confirm = useCallback(
    async (orderIds: string[]) => {
      if (!stored) throw new Error('No active session.')
      await confirmOrders(stored.sessionId, orderIds)
      refetch()
    },
    [stored, refetch],
  )

  const endSession = useCallback(async () => {
    if (!stored) throw new Error('No active session.')
    await closeSession(stored.sessionId)
    refetch()
  }, [stored, refetch])

  return {
    enabled,
    joining,
    joinError,
    session,
    deviceToken,
    role: session?.me?.role ?? null,
    canOrder: session?.can_order ?? false,
    isLeader: session?.me?.role === 'leader',
    status: session?.status ?? null,
    refetch,
    submitOrder,
    captureContact,
    askForBill,
    pay,
    promote,
    confirm,
    endSession,
  }
}
