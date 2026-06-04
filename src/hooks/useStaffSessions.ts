/**
 * Staff floor cockpit data: polls the tenant's live dining sessions and exposes
 * the staff actions (promote leader, batch-confirm pending orders, request bill,
 * close, cash-settle, dispute). All calls carry the staff JWT (apiFetch default).
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeSession,
  confirmOrders,
  disputeCheck,
  listSessions,
  promoteDevice,
  settleCheckCash,
  type DiningSessionView,
} from '../lib/api/dining'

const POLL_INTERVAL_MS = 5000
const QUERY_KEY = ['staff-sessions']

export interface UseStaffSessionsResult {
  sessions: DiningSessionView[]
  loading: boolean
  error: boolean
  refetch: () => void
  promote: (sessionId: string, deviceToken: string) => Promise<void>
  confirm: (sessionId: string, orderIds: string[]) => Promise<void>
  settleCash: (sessionId: string) => Promise<void>
  dispute: (sessionId: string, reason?: string) => Promise<void>
  close: (sessionId: string) => Promise<void>
}

export function useStaffSessions(enabled: boolean): UseStaffSessionsResult {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listSessions,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  })

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }, [queryClient])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn()
      refetch()
    },
    [refetch],
  )

  return {
    sessions: query.data?.results ?? [],
    loading: query.isLoading,
    error: query.isError,
    refetch,
    promote: (sessionId, deviceToken) => run(() => promoteDevice(sessionId, deviceToken)),
    confirm: (sessionId, orderIds) => run(() => confirmOrders(sessionId, orderIds)),
    settleCash: (sessionId) => run(() => settleCheckCash(sessionId)),
    dispute: (sessionId, reason) => run(() => disputeCheck(sessionId, reason)),
    close: (sessionId) => run(() => closeSession(sessionId)),
  }
}
