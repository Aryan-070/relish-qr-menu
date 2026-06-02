import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChefHat, Clock } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../components/Toast'
import { isHard } from '../lib/skin'
import { fadeUp, stagger } from '../../animations/variants'
import type { OrderRecord, OrderStatus, Table } from '../lib/types'

// ── Station routing ─────────────────────────────────────────────────────────
type Station = 'Hot Kitchen' | 'Bar' | 'Dessert'
const STATION_BY_CATEGORY: Record<string, Station> = {
  beverages: 'Bar',
  desserts: 'Dessert',
}
function stationFor(categoryId: string): Station {
  return STATION_BY_CATEGORY[categoryId] ?? 'Hot Kitchen'
}

type StationFilter = 'all' | Station
const STATION_FILTERS: { value: StationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Hot Kitchen', label: 'Kitchen' },
  { value: 'Bar', label: 'Bar' },
  { value: 'Dessert', label: 'Dessert' },
]

// Seed/legacy orders carry no status; an unpaid one is treated as in-progress.
function effectiveStatus(o: OrderRecord): OrderStatus {
  return o.status ?? 'preparing'
}

const STATUS_ORDER: Record<OrderStatus, number> = { new: 0, preparing: 1, ready: 2, served: 3 }

// Next step in the kitchen lifecycle + its button label.
const NEXT: Record<Exclude<OrderStatus, 'served'>, { to: OrderStatus; label: string }> = {
  new: { to: 'preparing', label: 'Start cooking' },
  preparing: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'served', label: 'Served · bump' },
}

// Ticket aging → colour (minutes since placed).
function ageColor(minutes: number): { fg: string; tint: string } {
  if (minutes < 5) return { fg: '#3F7A3C', tint: 'rgba(79,122,60,0.12)' }
  if (minutes < 10) return { fg: '#9A6A12', tint: 'rgba(217,160,58,0.16)' }
  return { fg: '#B0202F', tint: 'rgba(176,32,47,0.12)' }
}

interface TicketProps {
  order: OrderRecord
  table: Table | undefined
  now: number
  stationFilter: StationFilter
  onAdvance: (order: OrderRecord) => void
}

function Ticket({ order, table, now, stationFilter, onAdvance }: TicketProps) {
  const { tokens: t } = useTheme()
  const status = effectiveStatus(order)
  const minutes = Math.max(0, Math.floor((now - order.placedAt) / 60_000))
  const age = ageColor(minutes)
  const next = status === 'served' ? null : NEXT[status]
  const radius = isHard(t) ? 0 : 14

  return (
    <motion.div variants={fadeUp} layout>
      <div
        className="flex flex-col"
        style={{
          background: t.cardBg,
          border: `1px solid ${t.ruleColor}`,
          borderLeft: `4px solid ${age.fg}`,
          borderRadius: radius,
          boxShadow: t.cardShadow,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[15px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
              {table?.label ?? order.tableId}
            </span>
            <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {order.id}
            </span>
            {order.source === 'guest' && (
              <span
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5"
                style={{ background: 'rgba(217,160,58,0.16)', color: '#9A6A12', borderRadius: isHard(t) ? 0 : 999 }}
              >
                Scan
              </span>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 shrink-0"
            style={{ background: age.tint, color: age.fg, borderRadius: isHard(t) ? 0 : 999, fontFamily: t.descFont }}
          >
            <Clock size={11} /> {minutes}m
          </span>
        </div>

        {/* Lines */}
        <div className="px-3.5 py-2.5 flex flex-col gap-2 flex-1">
          {order.lines.map((line, idx) => {
            const lineStation = stationFor(line.categoryId)
            const dim = stationFilter !== 'all' && lineStation !== stationFilter
            return (
              <div key={`${line.itemId}-${idx}`} style={{ opacity: dim ? 0.32 : 1 }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: age.fg, fontFamily: t.descFont }}>
                    {line.qty}×
                  </span>
                  <span className="text-[13px] font-medium" style={{ color: t.ink, fontFamily: t.descFont }}>
                    {line.name}
                  </span>
                </div>
                {line.modifiers && (
                  <p className="text-[11px] ml-6" style={{ color: t.descColor, fontFamily: t.descFont }}>
                    {line.modifiers}
                  </p>
                )}
                {line.note && (
                  <p className="text-[11px] ml-6 italic" style={{ color: '#9A6A12', fontFamily: t.descFont }}>
                    “{line.note}”
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Action */}
        {next && (
          <div className="px-3.5 pb-3 pt-1">
            <Button
              variant={status === 'ready' ? 'gold' : 'primary'}
              size="sm"
              fullWidth
              onClick={() => onAdvance(order)}
            >
              {next.label}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function KitchenDisplay() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()
  const [stationFilter, setStationFilter] = useState<StationFilter>('all')
  const [now, setNow] = useState(() => Date.now())

  // Tick so ticket ages stay fresh even without store changes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])

  const tableById = useMemo(() => {
    const m = new Map<string, Table>()
    for (const tb of ops.state.tables) m.set(tb.id, tb)
    return m
  }, [ops.state.tables])

  // Active kitchen tickets: unpaid and not yet served.
  const tickets = useMemo(() => {
    const active = ops.state.orders.filter(o => !o.paid && effectiveStatus(o) !== 'served')
    const inStation =
      stationFilter === 'all'
        ? active
        : active.filter(o => o.lines.some(l => stationFor(l.categoryId) === stationFilter))
    return [...inStation].sort((a, b) => {
      const byStatus = STATUS_ORDER[effectiveStatus(a)] - STATUS_ORDER[effectiveStatus(b)]
      return byStatus !== 0 ? byStatus : a.placedAt - b.placedAt
    })
  }, [ops.state.orders, stationFilter])

  // All-day production counts (item → qty) across the visible tickets.
  const allDay = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of tickets) {
      for (const l of o.lines) {
        if (stationFilter !== 'all' && stationFor(l.categoryId) !== stationFilter) continue
        counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [tickets, stationFilter])

  const newCount = useMemo(
    () => ops.state.orders.filter(o => !o.paid && effectiveStatus(o) === 'new').length,
    [ops.state.orders],
  )

  const advance = (order: OrderRecord) => {
    const status = effectiveStatus(order)
    if (status === 'served') return
    const { to } = NEXT[status]
    ops.setOrderStatus(order.id, to)
    const label = tableById.get(order.tableId)?.label ?? order.tableId
    push(`${order.id} · ${label} → ${to}`, to === 'ready' ? 'success' : 'info')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
            Kitchen Display
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            {tickets.length} active {tickets.length === 1 ? 'ticket' : 'tickets'}
            {newCount > 0 && ` · ${newCount} new`}
          </p>
        </div>
        <SegmentedControl<StationFilter>
          options={STATION_FILTERS}
          value={stationFilter}
          onChange={setStationFilter}
          ariaLabel="Filter by station"
          size="sm"
        />
      </div>

      {/* All-day production strip */}
      {allDay.length > 0 && (
        <Panel padded>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: t.descColor, fontFamily: t.descFont }}>
              All day
            </span>
            {allDay.map(([name, qty]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1"
                style={{ background: 'rgba(217,160,58,0.08)', color: t.ink, borderRadius: isHard(t) ? 0 : 999, fontFamily: t.descFont }}
              >
                <strong style={{ color: '#9A6A12' }}>{qty}</strong> {name}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {tickets.length === 0 ? (
        <Panel padded={false}>
          <EmptyState
            icon={<ChefHat size={30} />}
            title="No tickets cooking"
            description="When a guest places an order it lands here in real time. Try placing one from the guest menu."
          />
        </Panel>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {tickets.map(order => (
            <Ticket
              key={order.id}
              order={order}
              table={tableById.get(order.tableId)}
              now={now}
              stationFilter={stationFilter}
              onAdvance={advance}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
