import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Droplet, Receipt, HelpCircle, Trash2, type LucideIcon } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../components/Toast'
import { REQUEST_STATUS, REQUEST_TYPE_LABEL } from '../lib/statusColors'
import { isHard } from '../lib/skin'
import { ago } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { RequestStatus, RequestType, ServiceRequest, Staff, Table } from '../lib/types'

type Filter = 'all' | 'pending' | 'claimed' | 'resolved'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'resolved', label: 'Resolved' },
]

const TYPE_ICON: Record<RequestType, LucideIcon> = {
  waiter: Bell,
  water: Droplet,
  bill: Receipt,
  assistance: HelpCircle,
  cleanup: Trash2,
}

// Pending first, then claimed, then resolved; oldest first within a group.
const STATUS_ORDER: Record<RequestStatus, number> = { pending: 0, claimed: 1, resolved: 2 }

interface RequestRowProps {
  req: ServiceRequest
  table: Table | undefined
  claimer: Staff | undefined
  onClaim: (req: ServiceRequest) => void
  onResolve: (req: ServiceRequest) => void
}

function RequestRow({ req, table, claimer, onClaim, onResolve }: RequestRowProps) {
  const { tokens: t } = useTheme()
  const Icon = TYPE_ICON[req.type]
  const status = REQUEST_STATUS[req.status]

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex items-start gap-3 px-3.5 py-3"
        style={{ borderBottom: `1px solid ${t.ruleColor}` }}
      >
        <span
          className="inline-flex items-center justify-center w-9 h-9 shrink-0"
          style={{ background: status.tint, color: status.fg, borderRadius: isHard(t) ? 0 : 999 }}
          aria-hidden
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold" style={{ color: t.ink, fontFamily: t.descFont }}>
              {table?.label ?? req.tableId}
            </span>
            <span className="text-[13px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
              {REQUEST_TYPE_LABEL[req.type]}
            </span>
            <Badge status={status} />
          </div>
          {req.note && (
            <p className="text-[12px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
              “{req.note}”
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
            <span>{ago(req.createdAt)}</span>
            {req.status !== 'pending' && claimer && (
              <span className="inline-flex items-center gap-1.5">
                · <Avatar name={claimer.name} hue={claimer.hue} size={18} /> {claimer.name}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 self-center">
          {req.status === 'pending' && (
            <Button variant="primary" size="sm" onClick={() => onClaim(req)}>
              Claim
            </Button>
          )}
          {req.status === 'claimed' && (
            <Button variant="gold" size="sm" onClick={() => onResolve(req)}>
              Resolve
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function ServiceQueue() {
  const { tokens: t } = useTheme()
  const { currentWaiterId } = useViewCtx()
  const ops = useOpsStore()
  const { push } = useToast()

  const [filter, setFilter] = useState<Filter>('all')

  const tableById = useMemo(() => {
    const m = new Map<string, Table>()
    for (const tb of ops.state.tables) m.set(tb.id, tb)
    return m
  }, [ops.state.tables])

  const staffById = useMemo(() => {
    const m = new Map<string, Staff>()
    for (const s of ops.state.staff) m.set(s.id, s)
    return m
  }, [ops.state.staff])

  const pendingCount = useMemo(
    () => ops.state.requests.filter(r => r.status === 'pending').length,
    [ops.state.requests],
  )

  const visible = useMemo(() => {
    const list = ops.state.requests.filter(r => filter === 'all' || r.status === filter)
    return [...list].sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return byStatus !== 0 ? byStatus : a.createdAt - b.createdAt
    })
  }, [ops.state.requests, filter])

  const claim = (req: ServiceRequest) => {
    ops.claimRequest(req.id, currentWaiterId)
    const label = tableById.get(req.tableId)?.label ?? req.tableId
    push(`Claimed ${REQUEST_TYPE_LABEL[req.type].toLowerCase()} · ${label}`, 'info')
  }

  const resolve = (req: ServiceRequest) => {
    ops.resolveRequest(req.id)
    const label = tableById.get(req.tableId)?.label ?? req.tableId
    push(`Resolved ${REQUEST_TYPE_LABEL[req.type].toLowerCase()} · ${label}`, 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
            Service Queue
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
          </p>
        </div>
        <SegmentedControl<Filter>
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter service requests"
          size="sm"
        />
      </div>

      <Panel padded={false}>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Bell size={30} />}
            title="Nothing in the queue"
            description={
              filter === 'all'
                ? 'New guest requests will appear here in real time.'
                : `No ${filter} requests right now.`
            }
          />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {visible.map(req => (
              <RequestRow
                key={req.id}
                req={req}
                table={tableById.get(req.tableId)}
                claimer={req.claimedBy ? staffById.get(req.claimedBy) : undefined}
                onClaim={claim}
                onResolve={resolve}
              />
            ))}
          </motion.div>
        )}
      </Panel>
    </div>
  )
}
