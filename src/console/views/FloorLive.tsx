import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarClock, Plus, Users } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { isStaffAuthed, staffLogout } from '../../lib/api/auth'
import { StaffLogin } from '../../components/StaffLogin'
import { useToast } from '../components/Toast'
import { Panel } from '../components/Panel'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SegmentedControl } from '../components/SegmentedControl'
import { SelectField, TextField, NumberField } from '../components/Field'
import { EmptyState } from '../components/EmptyState'
import { TABLE_STATUS } from '../lib/statusColors'
import { fadeUp, stagger } from '../../animations/variants'
import { panelStyle, isHard, bodyStyle } from '../lib/skin'
import { cn, clockTime } from '../lib/format'
import type { TableStatus, Zone } from '../lib/types'
import {
  assignWaiter,
  clearTable,
  createTable,
  isConflict,
  listTables,
  seatTable,
  setTableStatus,
  type AdminTable,
  type TableDraft,
} from '../lib/floorApi'
import { listStaff, type AdminStaff } from '../lib/staffApi'
import { listReservations, type AdminReservation } from '../lib/reservationsApi'

type ZoneFilter = 'All' | Zone

const ZONE_OPTIONS: Array<{ value: ZoneFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Garden', label: 'Garden' },
  { value: 'Indoor', label: 'Indoor' },
  { value: 'Patio', label: 'Patio' },
  { value: 'Bar', label: 'Bar' },
]

const ZONE_CHOICES: Array<{ value: Zone; label: string }> = ZONE_OPTIONS.filter(
  (o): o is { value: Zone; label: string } => o.value !== 'All',
)

const STATUS_ORDER: TableStatus[] = ['available', 'seated', 'ordering', 'bill-requested', 'needs-attention']

// Statuses a manager can set directly from the card (Seat / Clear handled separately).
const QUICK_STATUSES: TableStatus[] = ['seated', 'ordering', 'bill-requested', 'needs-attention']

const UPCOMING_LIMIT = 6
const SOON_WINDOW_MS = 90 * 60 * 1000

const TABLES_KEY = ['floor-tables']
const STAFF_KEY = ['floor-staff']
const RESERVATIONS_KEY = ['floor-reservations']

/** Deterministic hue (0–360) for a staff avatar (memberships carry no stored hue). */
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

/**
 * The live Floor cockpit — the console's floor view on the Django API
 * (`/api/ops/tables/` + the org's memberships + reservations) via React Query.
 * Self-contained: gates on the Django staff login and does not touch the
 * localStorage useOpsStore. Polls every 5s so another staff member's seat/status
 * change appears here too.
 */
export function FloorLive() {
  const [authed, setAuthed] = useState(isStaffAuthed())
  if (!authed) {
    return (
      <StaffLogin
        onSuccess={() => setAuthed(true)}
        title="Console sign-in"
        subtitle="Sign in to manage the live floor."
      />
    )
  }
  return <FloorEditor onSignOut={() => { staffLogout(); setAuthed(false) }} />
}

function FloorEditor({ onSignOut }: { onSignOut: () => void }) {
  const { tokens: t } = useTheme()
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [zone, setZone] = useState<ZoneFilter>('All')
  const [seatTarget, setSeatTarget] = useState<AdminTable | null>(null)
  const [seatGuests, setSeatGuests] = useState(2)
  const [clearTarget, setClearTarget] = useState<AdminTable | null>(null)
  const [adding, setAdding] = useState(false)
  const radius = isHard(t) ? 0 : 999

  const tablesQuery = useQuery({ queryKey: TABLES_KEY, queryFn: listTables, refetchInterval: 5000 })
  const staffQuery = useQuery({ queryKey: STAFF_KEY, queryFn: listStaff })
  const reservationsQuery = useQuery({ queryKey: RESERVATIONS_KEY, queryFn: listReservations })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TABLES_KEY })

  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data])
  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data])
  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data])

  const now = Date.now()
  const upcoming = useMemo(
    () => reservations.filter(r => r.status === 'booked' && r.at >= now).sort((a, b) => a.at - b.at),
    [reservations, now],
  )
  const upcomingTop = useMemo(() => upcoming.slice(0, UPCOMING_LIMIT), [upcoming])
  const bookedSoon = useMemo(() => upcoming.filter(r => r.at - now <= SOON_WINDOW_MS).length, [upcoming, now])

  // Anyone active on the floor can be assigned a table (waiters, managers, the
  // owner covering a shift) — the backend `waiter_membership` accepts any membership.
  const waiters = useMemo(() => staff.filter(s => s.active), [staff])
  const staffById = useMemo(() => {
    const map = new Map<string, AdminStaff>()
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
    () => [{ value: '', label: 'Unassigned' }, ...waiters.map(w => ({ value: w.id, label: w.name }))],
    [waiters],
  )

  // A stale `version` (409) means another device moved first — refetch and tell the user.
  const onMutationError = (err: unknown, label: string) => {
    push(isConflict(err) ? `${label} changed elsewhere — refreshing` : `Couldn’t update ${label}`, 'info')
    invalidate()
  }

  const assign = useMutation({
    mutationFn: (v: { table: AdminTable; waiterId: string }) =>
      assignWaiter(v.table.id, v.table.version, v.waiterId || null),
    onSuccess: (_d, v) => {
      invalidate()
      const w = v.waiterId ? staffById.get(v.waiterId) : null
      push(w ? `${v.table.label} assigned to ${w.name}` : `${v.table.label} unassigned`, 'info')
    },
    onError: (err, v) => onMutationError(err, v.table.label),
  })

  const status = useMutation({
    mutationFn: (v: { table: AdminTable; status: TableStatus }) =>
      setTableStatus(v.table.id, v.table.version, v.status),
    onSuccess: (_d, v) => {
      invalidate()
      push(`${v.table.label} → ${TABLE_STATUS[v.status].label}`, 'info')
    },
    onError: (err, v) => onMutationError(err, v.table.label),
  })

  const seat = useMutation({
    mutationFn: (v: { table: AdminTable; guests: number }) =>
      seatTable(v.table.id, v.table.version, v.guests),
    onSuccess: (_d, v) => {
      invalidate()
      push(`${v.table.label} seated · ${v.guests} guests`, 'success')
      setSeatTarget(null)
    },
    onError: (err, v) => { onMutationError(err, v.table.label); setSeatTarget(null) },
  })

  const clear = useMutation({
    mutationFn: (v: { table: AdminTable }) => clearTable(v.table.id, v.table.version),
    onSuccess: (_d, v) => {
      invalidate()
      push(`${v.table.label} cleared`, 'success')
      setClearTarget(null)
    },
    onError: (err, v) => { onMutationError(err, v.table.label); setClearTarget(null) },
  })

  const create = useMutation({
    mutationFn: (draft: TableDraft) => createTable(draft),
    onSuccess: d => {
      invalidate()
      push(`${d.label} added`, 'success')
      setAdding(false)
    },
    onError: () => push('Couldn’t add the table — the code may already be in use', 'info'),
  })

  const openSeat = (table: AdminTable) => {
    setSeatGuests(Math.min(2, table.seats) || 1)
    setSeatTarget(table)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Eyebrow + actions */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ ...bodyStyle(t), color: t.descColor }}>
          Live floor · Django
        </p>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} aria-label="Add table">
            <Plus size={15} aria-hidden /> Add table
          </Button>
          <button
            onClick={onSignOut}
            className="text-[12px] px-3 py-1.5"
            style={{ ...bodyStyle(t), color: t.descColor, border: `1px solid ${t.ruleColor}`, borderRadius: radius }}
          >
            Sign out
          </button>
        </div>
      </div>

      {tablesQuery.isLoading ? (
        <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>Loading the live floor…</p>
      ) : tablesQuery.isError ? (
        <p className="text-[13px] py-10 text-center" style={{ color: '#c0392b' }}>
          Couldn’t load the floor. Your session may have expired — sign out and back in.
        </p>
      ) : (
        <>
          {/* Summary strip */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
          >
            {STATUS_ORDER.map(s => {
              const style = TABLE_STATUS[s]
              return (
                <motion.div
                  key={s}
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
                      {counts[s]}
                    </span>
                  </span>
                  <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: style.fg }} />
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
                  <EmptyState
                    title={tables.length === 0 ? 'No tables yet' : 'No tables in this zone'}
                    description={tables.length === 0 ? 'Add a table to get started.' : 'Try a different zone filter.'}
                  />
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
                      waiter={table.waiterMembershipId ? staffById.get(table.waiterMembershipId) : undefined}
                      waiterOptions={waiterOptions}
                      onAssign={(tbl, waiterId) => assign.mutate({ table: tbl, waiterId })}
                      onStatus={(tbl, s) => status.mutate({ table: tbl, status: s })}
                      onSeat={openSeat}
                      onClear={setClearTarget}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            <UpcomingReservations reservations={upcomingTop} total={upcoming.length} now={now} />
          </div>
        </>
      )}

      {/* Seat modal */}
      <Modal
        open={!!seatTarget}
        onClose={() => setSeatTarget(null)}
        title={seatTarget ? `Seat ${seatTarget.label}` : 'Seat table'}
        width={360}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setSeatTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={seat.isPending}
              onClick={() => seatTarget && seat.mutate({ table: seatTarget, guests: seatGuests })}
            >
              {seat.isPending ? 'Seating…' : 'Seat guests'}
            </Button>
          </>
        }
      >
        {seatTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
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
                {Array.from({ length: Math.max(seatTarget.seats, 1) }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeatGuests(n)}
                    aria-label={`${n} guests`}
                    aria-pressed={seatGuests === n}
                    className={cn('w-10 h-10 inline-flex items-center justify-center text-[14px] font-semibold cursor-pointer tabular-nums transition-colors')}
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
        confirmLabel={clear.isPending ? 'Clearing…' : 'Clear table'}
        danger
        onConfirm={() => clearTarget && clear.mutate({ table: clearTarget })}
        onCancel={() => setClearTarget(null)}
      />

      {/* Add table */}
      {adding && (
        <AddTableModal
          pending={create.isPending}
          onClose={() => setAdding(false)}
          onCreate={draft => create.mutate(draft)}
        />
      )}
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
  reservations: AdminReservation[]
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
        <p className="text-[13px] italic py-2" style={{ fontFamily: t.descFont, color: t.descColor }}>
          No upcoming reservations
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservations.map(r => (
            <li
              key={r.id}
              className="flex flex-col gap-1 px-3 py-2.5"
              style={{ borderRadius: hard ? 0 : 10, border: `1px solid ${t.ruleColor}`, background: 'transparent' }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] tabular-nums" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}>
                  {clockTime(r.at)}
                </span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: t.accent, fontFamily: t.descFont, fontWeight: 600 }}>
                  {leadTime(r.at, now)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[13px] truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
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
                <p className="text-[12px] leading-snug" style={{ fontFamily: t.descFont, color: t.descColor }}>
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
  table: AdminTable
  waiter?: AdminStaff
  waiterOptions: Array<{ value: string; label: string }>
  onAssign: (table: AdminTable, waiterId: string) => void
  onStatus: (table: AdminTable, status: TableStatus) => void
  onSeat: (table: AdminTable) => void
  onClear: (table: AdminTable) => void
}

function TableCard({ table, waiter, waiterOptions, onAssign, onStatus, onSeat, onClear }: TableCardProps) {
  const { tokens: t } = useTheme()

  return (
    <motion.div variants={fadeUp} style={panelStyle(t)} className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] leading-tight truncate" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}>
            {table.label}
          </h3>
          <p className="text-[12px] flex items-center gap-1.5 mt-0.5" style={{ fontFamily: t.descFont, color: t.descColor }}>
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
            <Avatar name={waiter.name} hue={hueFor(waiter.id || waiter.name)} size={26} />
            <span className="text-[13px] truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
              {waiter.name}
            </span>
          </>
        ) : (
          <span className="text-[13px] italic" style={{ fontFamily: t.descFont, color: t.descColor }}>
            Unassigned
          </span>
        )}
      </div>

      <SelectField
        label="Waiter"
        value={table.waiterMembershipId ?? ''}
        onChange={v => onAssign(table, v)}
        options={waiterOptions}
      />

      {/* Status quick controls */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map(s => {
          const active = table.status === s
          const style = TABLE_STATUS[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(table, s)}
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
          <Button variant="primary" size="sm" fullWidth onClick={() => onSeat(table)} aria-label={`Seat ${table.label}`}>
            Seat
          </Button>
        ) : (
          <Button variant="subtle" size="sm" fullWidth onClick={() => onClear(table)} aria-label={`Clear ${table.label}`}>
            Clear
          </Button>
        )}
      </div>
    </motion.div>
  )
}

interface AddTableModalProps {
  pending: boolean
  onClose: () => void
  onCreate: (draft: TableDraft) => void
}

function AddTableModal({ pending, onClose, onCreate }: AddTableModalProps) {
  const [draft, setDraft] = useState<TableDraft>({ code: '', label: '', seats: 2, zone: 'Indoor' })
  const set = <K extends keyof TableDraft>(k: K, v: TableDraft[K]) => setDraft(d => ({ ...d, [k]: v }))
  const valid = draft.code.trim().length > 0 && draft.label.trim().length > 0 && draft.seats > 0

  return (
    <Modal
      open
      onClose={onClose}
      title="Add table"
      width={380}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={pending || !valid} onClick={() => onCreate(draft)}>
            {pending ? 'Adding…' : 'Add table'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Code" value={draft.code} onChange={v => set('code', v)} placeholder="T7" />
          <NumberField label="Seats" value={draft.seats} onChange={v => set('seats', v)} min={1} />
        </div>
        <TextField label="Label" value={draft.label} onChange={v => set('label', v)} placeholder="Table 7" />
        <SelectField label="Zone" value={draft.zone} onChange={v => set('zone', v as Zone)} options={ZONE_CHOICES} />
      </div>
    </Modal>
  )
}
