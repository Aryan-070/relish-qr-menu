import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Bell } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { ApiError } from '../../lib/api/client'
import {
  actOnServiceRequest,
  confirmOrders,
  listServiceRequests,
  listSessions,
  promoteDevice,
} from '../../lib/api/dining'

const SESSIONS_KEY = ['live-sessions']
const REQUESTS_KEY = ['live-service-requests']

/**
 * Live, backend-driven floor view for the dining sessions: promote a host
 * (required for the leader-only ordering default), confirm pending orders, and
 * work the guest service-request queue. Polls every few seconds.
 */
export function LiveTables() {
  const { tokens: t } = useTheme()
  const toast = useToast()
  const qc = useQueryClient()

  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: listSessions, refetchInterval: 5000 })
  const requests = useQuery({ queryKey: REQUESTS_KEY, queryFn: listServiceRequests, refetchInterval: 5000 })

  const onErr = (e: unknown) =>
    toast.push(e instanceof ApiError ? (e.body?.detail ?? e.message) : 'Action failed', 'warn')

  const promote = useMutation({
    mutationFn: ({ sessionId, deviceId }: { sessionId: string; deviceId: string }) =>
      promoteDevice(sessionId, deviceId),
    onSuccess: () => { toast.push('Host set — they can now order'); qc.invalidateQueries({ queryKey: SESSIONS_KEY }) },
    onError: onErr,
  })
  const confirm = useMutation({
    mutationFn: ({ sessionId, orderIds }: { sessionId: string; orderIds: string[] }) =>
      confirmOrders(sessionId, orderIds),
    onSuccess: () => { toast.push('Order sent to kitchen'); qc.invalidateQueries({ queryKey: SESSIONS_KEY }) },
    onError: onErr,
  })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'claim' | 'resolve' }) => actOnServiceRequest(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
    onError: onErr,
  })

  const sessionList = sessions.data?.results ?? []
  const requestList = requests.data?.results ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Service requests */}
      <Panel title="Service requests" subtitle="Guest calls for a waiter / water / bill.">
        {requestList.length === 0 ? (
          <EmptyState icon={<Bell size={24} />} title="Nothing waiting" description="Guest service calls show up here." />
        ) : (
          <div className="flex flex-col gap-2">
            {requestList.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ border: `1px solid ${t.ruleColor}` }}>
                <span className="text-[13px]" style={{ color: t.ink, fontFamily: t.descFont }}>
                  <span className="capitalize font-semibold">{r.kind}</span>
                  {r.note ? ` — ${r.note}` : ''} · {r.status}
                </span>
                <div className="flex gap-2">
                  {r.status === 'pending' && (
                    <Button size="sm" variant="subtle" onClick={() => act.mutate({ id: r.id, action: 'claim' })}>Claim</Button>
                  )}
                  <Button size="sm" onClick={() => act.mutate({ id: r.id, action: 'resolve' })}>Resolve</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Live sessions */}
      <Panel title="Live tables" subtitle="Set a host to start ordering; confirm pending orders.">
        {sessions.isLoading ? (
          <p className="text-[13px] py-6" style={{ color: t.descColor, fontFamily: t.descFont }}>Loading…</p>
        ) : sessionList.length === 0 ? (
          <EmptyState title="No live tables" description="Tables appear when guests scan their QR." />
        ) : (
          <div className="flex flex-col gap-4">
            {sessionList.map(s => {
              const pending = s.orders.filter(o => o.confirmation === 'pending_confirmation')
              return (
                <div key={s.id} className="rounded-xl p-3" style={{ border: `1px solid ${t.ruleColor}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[14px]" style={{ color: t.ink, fontFamily: t.titleFont }}>
                      Table {s.table_label || s.table_code}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide" style={{ color: t.descColor }}>
                      {s.order_confirmation_mode.replace('_', ' ')} · {s.status}
                    </span>
                  </div>

                  {/* Devices + promote-to-host */}
                  <div className="flex flex-col gap-1.5">
                    {s.devices.map(d => {
                      const isLeader = s.leader_device === d.id
                      return (
                        <div key={d.id} className="flex items-center justify-between text-[12.5px]" style={{ color: t.ink, fontFamily: t.descFont }}>
                          <span className="flex items-center gap-1.5">
                            {isLeader && <Crown size={13} style={{ color: t.accent }} />}
                            {d.display_name || 'Guest'} · {d.role}
                          </span>
                          {!isLeader && (
                            <Button size="sm" variant="subtle" onClick={() => promote.mutate({ sessionId: s.id, deviceId: d.id })}>
                              Make host
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Pending orders to confirm */}
                  {pending.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${t.ruleColor}` }}>
                      <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: t.descColor }}>Awaiting confirmation</p>
                      {pending.map(o => (
                        <div key={o.id} className="flex items-center justify-between text-[12.5px]" style={{ color: t.ink }}>
                          <span>{o.code} — {o.lines.map(l => `${l.qty}× ${l.item_name}`).join(', ')}</span>
                          <Button size="sm" onClick={() => confirm.mutate({ sessionId: s.id, orderIds: [o.id] })}>Send to kitchen</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
