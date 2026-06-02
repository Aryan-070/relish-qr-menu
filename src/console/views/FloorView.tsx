import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, Users } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { useToast } from '../components/Toast'
import { Panel } from '../components/Panel'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SegmentedControl } from '../components/SegmentedControl'
import { SelectField } from '../components/Field'
import { EmptyState } from '../components/EmptyState'
import { TABLE_STATUS } from '../lib/statusColors'
import { fadeUp, stagger } from '../../animations/variants'
import { panelStyle, isHard } from '../lib/skin'
import { cn, clockTime } from '../lib/format'
import type { Reservation, Staff, Table, TableStatus, Zone } from '../lib/types'

type ZoneFilter = 'All' | Zone

const ZONE_OPTIONS: Array<{ value: ZoneFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Garden', label: 'Garden' },
  { value: 'Indoor', label: 'Indoor' },
  { value: 'Patio', label: 'Patio' },
  { value: 'Bar', label: 'Bar' },
]

const STATUS_ORDER: TableStatus[] = [
  'available',
  'seated',
  'ordering',
  'bill-requested',
  'needs-attention',
]

// Statuses a manager can set directly from the card (Seat / Clear handled separately).
const QUICK_STATUSES: TableStatus[] = ['seated', 'ordering', 'bill-requested', 'needs-attention']

// How many upcoming bookings to surface, and the window for the "booked soon" hint.
const UPCOMING_LIMIT = 6
const SOON_WINDOW_MS = 90 * 60 * 1000

export function FloorView() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()
  const [zone, setZone] = useState<ZoneFilter>('All')
  const [seatTarget, setSeatTarget] = useState<Table | null>(null)
  const [seatGuests, setSeatGuests] = useState(2)
  const [clearTarget, setClearTarget] = useState<Table | null>(null)

  const tables = ops.state.tables
  const staff = ops.state.staff
  const reservations = ops.state.reservations

  // Upcoming, still-booked reservations from now onward — soonest first.
  const now = Date.now()
  const upcoming = useMemo(() => {
    return reservations
      .filter(r => r.status === 'booked' && r.at >= now)
      .sort((a, b) => a.at - b.at)
  }, [reservations, now])

  const upcomingTop = useMemo(() => upcoming.slice(0, UPCOMING_LIMIT), [upcoming])
  const bookedSoon = useMemo(
    () => upcoming.filter(r => r.at - now <= SOON_WINDOW_MS).length,
    [upcoming, now],
  )

  const waiters = useMemo(() => staff.filter(s => s.role === 'waiter'), [staff])
  const staffById = useMemo(() => {
    const map = new Map<string, Staff>()
    for (const s of staff) map.set(s.id, s)
    return map
  }, [staff])

  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = {
      available: 0,
      seated: 0,
      ordering: 0,
      'bill-requested': 0,
      'needs-attention': 0,
    }
    for (const tbl of tables) c[tbl.status] += 1
    return c
  }, [tables])

  const filtered = useMemo(
    () => (zone === 'All' ? tables : tables.filter(tbl => tbl.zone === zone)),
    [tables, zone],
  )

  const waiterOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...waiters.map(w => ({ value: w.id, label: w.name })),
    ],
    [waiters],
  )

  const handleAssign = (table: Table, waiterId: string) => {
    ops.assignWaiter(table.id, waiterId || null)
    const w = waiterId ? staffById.get(waiterId) : null
    push(w ? `${table.label} assigned to ${w.name}` : `${table.label} unassigned`, 'info')
  }

  const handleStatus = (table: Table, status: TableStatus) => {
    ops.setTableStatus(table.id, status)
    push(`${table.label} → ${TABLE_STATUS[status].label}`, 'info')
  }

  const openSeat = (table: Table) => {
    setSeatGuests(Math.min(2, table.seats) || 1)
    setSeatTarget(table)
  }

  const confirmSeat = () => {
    if (!seatTarget) return
    ops.seatTable(seatTarget.id, seatGuests)
    push(`${seatTarget.label} seated · ${seatGuests} guests`, 'success')
    setSeatTarget(null)
  }

  const confirmClear = () => {
    if (!clearTarget) return
    ops.clearTable(clearTarget.id)
    push(`${clearTarget.label} cleared`, 'success')
    setClearTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
      >
        {STATUS_ORDER.map(status => {
          const style = TABLE_STATUS[status]
          return (
            <motion.div
              key={status}
              variants={fadeUp}
              style={panelStyle(t)}
              className="px-3.5 py-3 flex items-center justify-between gap-2"
            >
              <span className="flex flex-col gap-0.5 min-w-0">
                <span
                  className="text-[11px] uppercase tracking-wider truncate"
                  style={{ color: t.descColor, fontFamily: t.descFont }}
                >
                  {style.label}
                </span>
                <span
                  className="text-[22px] leading-none tabular-nums"
                  style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", color: t.ink, fontWeight: 600 }}
                >
                  {counts[status]}
                </span>
              </span>
              <span
                aria-hidden
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: style.fg }}
              />
            </motion.div>
          )
        })}
      </motion.div>

      {/* Zone filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          className="text-[15px] flex items-center gap-2"
          style={{ fontFamily: t.titleFont, color: t.ink, fontWeight: t.titleWeight }}
        >
          <span>
            Live floor · {filtered.length} {filtered.length === 1 ? 'table' : 'tables'}
          </span>
          {bookedSoon > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 tabular-nums"
              style={{
                borderRadius: isHard(t) ? 0 : 999,
                border: `1px solid ${t.accent}`,
                color: t.accent,
                fontFamily: t.descFont,
              }}
              title={`${bookedSoon} booked within the next 90 minutes`}
            >
              <CalendarClock size={11} aria-hidden />
              {bookedSoon} booked soon
            </span>
          )}
        </h2>
        <SegmentedControl
          options={ZONE_OPTIONS}
          value={zone}
          onChange={setZone}
          ariaLabel="Filter tables by zone"
          size="sm"
        />
      </div>

      {/* Floor grid + upcoming reservations */}
      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">
          {filtered.length === 0 ? (
            <Panel>
              <EmptyState title="No tables in this zone" description="Try a different zone filter." />
            </Panel>
          ) : (
            <motion.div
              key={zone}
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {filtered.map(table => (
                <TableCard
                  key={table.id}
                  table={table}
                  waiter={table.waiterId ? staffById.get(table.waiterId) : undefined}
                  waiterOptions={waiterOptions}
                  onAssign={handleAssign}
                  onStatus={handleStatus}
                  onSeat={openSeat}
                  onClear={setClearTarget}
                />
              ))}
            </motion.div>
          )}
        </div>

        <UpcomingReservations
          reservations={upcomingTop}
          total={upcoming.length}
          now={now}
        />
      </div>

      {/* Seat modal */}
      <Modal
        open={!!seatTarget}
        onClose={() => setSeatTarget(null)}
        title={seatTarget ? `Seat ${seatTarget.label}` : 'Seat table'}
        width={360}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setSeatTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmSeat}>
              Seat guests
            </Button>
          </>
        }
      >
        {seatTarget && (
          <div className="flex flex-col gap-4">
            <p
              className="text-[13px]"
              style={{ fontFamily: t.descFont, color: t.descColor }}
            >
              {seatTarget.zone} · {seatTarget.seats} seats
            </p>
            <div className="flex flex-col gap-2">
              <span
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: t.inkSoft, fontFamily: t.descFont }}
              >
                Guests
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: seatTarget.seats }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeatGuests(n)}
                    aria-label={`${n} guests`}
                    aria-pressed={seatGuests === n}
                    className={cn(
                      'w-10 h-10 inline-flex items-center justify-center text-[14px] font-semibold cursor-pointer tabular-nums transition-colors',
                    )}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${seatGuests === n ? t.accent : t.ruleColor}`,
                      background: seatGuests === n ? t.accent : 'transparent',
                      color: seatGuests === n ? '#fff' : t.ink,
                      fontFamily: t.descFont,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear confirm */}
      <ConfirmDialog
        open={!!clearTarget}
        title={clearTarget ? `Clear ${clearTarget.label}?` : 'Clear table?'}
        message="This frees the table and resets its cover count. The party will be marked as departed."
        confirmLabel="Clear table"
        danger
        onConfirm={confirmClear}
        onCancel={() => setClearTarget(null)}
      />
    </div>
  )
}

/** "in 5m" / "in 2h" / "in 1h 20m" lead time from now to a future booking. */
function leadTime(at: number, now: number): string {
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem ? `in ${hrs}h ${rem}m` : `in ${hrs}h`
}

interface UpcomingReservationsProps {
  reservations: Reservation[]
  total: number
  now: number
}

function UpcomingReservations({ reservations, total, now }: UpcomingReservationsProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)

  return (
    <motion.aside
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      style={panelStyle(t)}
      className="w-full xl:w-[300px] xl:shrink-0 p-4 flex flex-col gap-3"
      aria-label="Upcoming reservations"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="text-[14px] flex items-center gap-1.5"
          style={{ fontFamily: t.titleFont, color: t.ink, fontWeight: t.titleWeight }}
        >
          <CalendarClock size={15} aria-hidden style={{ color: t.accent }} />
          Upcoming
        </h3>
        <span
          className="text-[11px] uppercase tracking-wider tabular-nums"
          style={{ color: t.descColor, fontFamily: t.descFont }}
        >
          {total} {total === 1 ? 'booking' : 'bookings'}
        </span>
      </div>

      {reservations.length === 0 ? (
        <p
          className="text-[13px] italic py-2"
          style={{ fontFamily: t.descFont, color: t.descColor }}
        >
          No upcoming reservations
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservations.map(r => (
            <li
              key={r.id}
              className="flex flex-col gap-1 px-3 py-2.5"
              style={{
                borderRadius: hard ? 0 : 10,
                border: `1px solid ${t.ruleColor}`,
                background: 'transparent',
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[14px] tabular-nums"
                  style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}
                >
                  {clockTime(r.at)}
                </span>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: t.accent, fontFamily: t.descFont, fontWeight: 600 }}
                >
                  {leadTime(r.at, now)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span
                  className="text-[13px] truncate"
                  style={{ fontFamily: t.descFont, color: t.ink }}
                >
                  {r.name}
                </span>
                <span
                  className="text-[12px] tabular-nums shrink-0 inline-flex items-center gap-1"
                  style={{ fontFamily: t.descFont, color: t.descColor }}
                >
                  <Users size={11} aria-hidden />
                  party of {r.partySize}
                </span>
              </div>
              {r.notes && (
                <p
                  className="text-[12px] leading-snug"
                  style={{ fontFamily: t.descFont, color: t.descColor }}
                >
                  {r.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </motion.aside>
  )
}

interface TableCardProps {
  table: Table
  waiter?: Staff
  waiterOptions: Array<{ value: string; label: string }>
  onAssign: (table: Table, waiterId: string) => void
  onStatus: (table: Table, status: TableStatus) => void
  onSeat: (table: Table) => void
  onClear: (table: Table) => void
}

function TableCard({
  table,
  waiter,
  waiterOptions,
  onAssign,
  onStatus,
  onSeat,
  onClear,
}: TableCardProps) {
  const { tokens: t } = useTheme()

  return (
    <motion.div
      variants={fadeUp}
      style={panelStyle(t)}
      className="p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className="text-[16px] leading-tight truncate"
            style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}
          >
            {table.label}
          </h3>
          <p
            className="text-[12px] flex items-center gap-1.5 mt-0.5"
            style={{ fontFamily: t.descFont, color: t.descColor }}
          >
            <span>{table.zone}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Users size={12} aria-hidden />
              {table.guests}/{table.seats}
            </span>
          </p>
        </div>
        <Badge status={TABLE_STATUS[table.status]} />
      </div>

      {/* Assigned waiter */}
      <div className="flex items-center gap-2">
        {waiter ? (
          <>
            <Avatar name={waiter.name} hue={waiter.hue} size={26} />
            <span
              className="text-[13px] truncate"
              style={{ fontFamily: t.descFont, color: t.ink }}
            >
              {waiter.name}
            </span>
          </>
        ) : (
          <span
            className="text-[13px] italic"
            style={{ fontFamily: t.descFont, color: t.descColor }}
          >
            Unassigned
          </span>
        )}
      </div>

      <SelectField
        label="Waiter"
        value={table.waiterId ?? ''}
        onChange={v => onAssign(table, v)}
        options={waiterOptions}
      />

      {/* Status quick controls */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map(status => {
          const active = table.status === status
          const style = TABLE_STATUS[status]
          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatus(table, status)}
              aria-label={`Set ${table.label} to ${style.label}`}
              aria-pressed={active}
              className="text-[11px] font-semibold px-2 py-1 cursor-pointer transition-colors min-h-[30px]"
              style={{
                borderRadius: 999,
                border: `1px solid ${active ? style.ring : t.ruleColor}`,
                background: active ? style.tint : 'transparent',
                color: active ? style.fg : t.inkSoft,
                fontFamily: t.descFont,
              }}
            >
              {style.label}
            </button>
          )
        })}
      </div>

      {/* Seat / Clear */}
      <div className="flex gap-2 mt-auto">
        {table.status === 'available' ? (
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => onSeat(table)}
            aria-label={`Seat ${table.label}`}
          >
            Seat
          </Button>
        ) : (
          <Button
            variant="subtle"
            size="sm"
            fullWidth
            onClick={() => onClear(table)}
            aria-label={`Clear ${table.label}`}
          >
            Clear
          </Button>
        )}
      </div>
    </motion.div>
  )
}
