import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarClock,
  ClipboardList,
  Plus,
  Users,
  Clock,
  BellRing,
  Armchair,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { TextField, NumberField } from '../components/Field'
import { useToast } from '../components/Toast'
import type { StatusStyle } from '../lib/statusColors'
import { isHard } from '../lib/skin'
import { clockTime, ago } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type {
  Reservation,
  ReservationStatus,
  WaitlistEntry,
  WaitStatus,
  Table,
} from '../lib/types'

// ── Status palettes (reservations + waitlist) ───────────────────────────────
// statusColors.ts only covers tables/requests; these mirror its shape so the
// shared Badge component renders them identically across skins.
const RESERVATION_STATUS: Record<ReservationStatus, StatusStyle> = {
  booked: { label: 'Booked', fg: '#2f5d8a', tint: 'rgba(47,93,138,0.12)', ring: 'rgba(47,93,138,0.40)' },
  seated: { label: 'Seated', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
  completed: { label: 'Completed', fg: '#6b6258', tint: 'rgba(74,63,58,0.10)', ring: 'rgba(74,63,58,0.28)' },
  cancelled: { label: 'Cancelled', fg: '#8a8178', tint: 'rgba(74,63,58,0.07)', ring: 'rgba(74,63,58,0.22)' },
  'no-show': { label: 'No-show', fg: '#b3141b', tint: 'rgba(215,25,32,0.12)', ring: 'rgba(215,25,32,0.45)' },
}

const WAIT_STATUS: Record<WaitStatus, StatusStyle> = {
  waiting: { label: 'Waiting', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.50)' },
  notified: { label: 'Notified', fg: '#9A6A12', tint: 'rgba(217,160,58,0.24)', ring: 'rgba(217,160,58,0.70)' },
  seated: { label: 'Seated', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
  left: { label: 'Left', fg: '#8a8178', tint: 'rgba(74,63,58,0.07)', ring: 'rgba(74,63,58,0.22)' },
}

// Booking time slots — buttons set the hour/minute on today's date.
const TIME_SLOTS: { h: number; m: number; label: string }[] = [
  { h: 12, m: 0, label: '12:00' },
  { h: 13, m: 0, label: '13:00' },
  { h: 19, m: 0, label: '19:00' },
  { h: 19, m: 30, label: '19:30' },
  { h: 20, m: 0, label: '20:00' },
  { h: 20, m: 30, label: '20:30' },
  { h: 21, m: 0, label: '21:00' },
]

// Reservation lifecycle ordering: active first, closed last; by time within.
const RES_ORDER: Record<ReservationStatus, number> = {
  booked: 0,
  seated: 1,
  completed: 2,
  'no-show': 3,
  cancelled: 4,
}

// Build an epoch-ms timestamp for a slot on today's date.
function slotAt(h: number, m: number): number {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

// Next quoted wait as a sensible default (rounded up to the next 5 minutes,
// scaled gently by how busy the waitlist already is).
function defaultQuote(activeWaiting: number): number {
  const base = 10 + activeWaiting * 5
  return Math.min(60, Math.ceil(base / 5) * 5)
}

function partyLabel(n: number): string {
  return `party of ${n}`
}

// ── Reservation row ──────────────────────────────────────────────────────────
interface ReservationRowProps {
  res: Reservation
  table: Table | undefined
  availableTables: Table[]
  picking: boolean
  onStartPick: (id: string) => void
  onCancelPick: () => void
  onChooseTable: (res: Reservation, table: Table) => void
  onCancel: (res: Reservation) => void
  onNoShow: (res: Reservation) => void
  onComplete: (res: Reservation) => void
}

function ReservationRow({
  res,
  table,
  availableTables,
  picking,
  onStartPick,
  onCancelPick,
  onChooseTable,
  onCancel,
  onNoShow,
  onComplete,
}: ReservationRowProps) {
  const { tokens: t } = useTheme()
  const closed = res.status === 'completed' || res.status === 'cancelled' || res.status === 'no-show'

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex flex-col gap-2.5 px-3.5 py-3"
        style={{ borderBottom: `1px solid ${t.ruleColor}`, opacity: closed ? 0.66 : 1 }}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex flex-col items-center justify-center w-14 shrink-0 px-1 py-1.5"
            style={{
              background: 'rgba(217,160,58,0.10)',
              color: t.ink,
              borderRadius: isHard(t) ? 0 : 10,
              border: `1px solid ${t.ruleColor}`,
            }}
            aria-hidden
          >
            <span className="text-[13px] font-bold tabular-nums leading-none" style={{ fontFamily: t.descFont }}>
              {clockTime(res.at)}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold" style={{ color: t.ink, fontFamily: t.descFont }}>
                {res.name}
              </span>
              <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                <Users size={13} aria-hidden /> {partyLabel(res.partySize)}
              </span>
              <Badge status={RESERVATION_STATUS[res.status]} />
              {res.status === 'seated' && table && (
                <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                  · {table.label}
                </span>
              )}
            </div>
            {res.notes && (
              <p className="text-[12px] mt-1 italic" style={{ color: t.descColor, fontFamily: t.descFont }}>
                “{res.notes}”
              </p>
            )}
            <div className="text-[11px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {res.phone}
            </div>
          </div>

          <div className="shrink-0 self-center flex items-center gap-1.5">
            {res.status === 'booked' && (
              <>
                <Button variant="primary" size="sm" onClick={() => onStartPick(res.id)}>
                  <Armchair size={14} aria-hidden /> Seat
                </Button>
                <Button variant="subtle" size="sm" onClick={() => onCancel(res)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={() => onNoShow(res)}>
                  No-show
                </Button>
              </>
            )}
            {res.status === 'seated' && (
              <Button variant="gold" size="sm" onClick={() => onComplete(res)}>
                Complete
              </Button>
            )}
          </div>
        </div>

        {/* Inline table picker (booked → choose an available table) */}
        {picking && res.status === 'booked' && (
          <div
            className="flex flex-col gap-2 px-3 py-2.5"
            style={{ background: 'rgba(42,30,30,0.04)', borderRadius: isHard(t) ? 0 : 10 }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                Assign a table
              </span>
              <button
                type="button"
                onClick={onCancelPick}
                aria-label="Cancel table selection"
                className="inline-flex items-center justify-center w-6 h-6 cursor-pointer"
                style={{ color: t.descColor }}
              >
                <X size={14} />
              </button>
            </div>
            {availableTables.length === 0 ? (
              <p className="text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                No tables free right now — clear one from My Tables first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTables.map(tb => (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => onChooseTable(res, tb)}
                    className="inline-flex flex-col items-start px-2.5 py-1.5 text-left cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      background: '#FFFFFF',
                      border: `1px solid ${t.ruleColor}`,
                      borderRadius: isHard(t) ? 0 : 8,
                      outlineColor: t.accent,
                    }}
                  >
                    <span className="text-[12px] font-semibold" style={{ color: t.ink, fontFamily: t.descFont }}>
                      {tb.label}
                    </span>
                    <span className="text-[10px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                      {tb.zone} · {tb.seats} seats
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Waitlist row ─────────────────────────────────────────────────────────────
interface WaitRowProps {
  entry: WaitlistEntry
  onNotify: (entry: WaitlistEntry) => void
  onSeat: (entry: WaitlistEntry) => void
  onRemove: (entry: WaitlistEntry) => void
}

function WaitRow({ entry, onNotify, onSeat, onRemove }: WaitRowProps) {
  const { tokens: t } = useTheme()
  const closed = entry.status === 'seated' || entry.status === 'left'

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex items-start gap-3 px-3.5 py-3"
        style={{ borderBottom: `1px solid ${t.ruleColor}`, opacity: closed ? 0.66 : 1 }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold" style={{ color: t.ink, fontFamily: t.descFont }}>
              {entry.name}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
              <Users size={13} aria-hidden /> {partyLabel(entry.partySize)}
            </span>
            <Badge status={WAIT_STATUS[entry.status]} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden /> ~{entry.quotedMins}m wait
            </span>
            <span aria-hidden>·</span>
            <span>added {ago(entry.addedAt)}</span>
          </div>
        </div>

        <div className="shrink-0 self-center flex items-center gap-1.5">
          {entry.status === 'waiting' && (
            <Button variant="gold" size="sm" onClick={() => onNotify(entry)}>
              <BellRing size={14} aria-hidden /> Notify
            </Button>
          )}
          {(entry.status === 'waiting' || entry.status === 'notified') && (
            <Button variant="primary" size="sm" onClick={() => onSeat(entry)}>
              Seat
            </Button>
          )}
          <Button variant="subtle" size="sm" onClick={() => onRemove(entry)} aria-label={`Remove ${entry.name} from waitlist`}>
            Remove
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ── New booking form ─────────────────────────────────────────────────────────
interface BookingFormProps {
  onSubmit: (input: { name: string; phone: string; partySize: number; at: number }) => boolean
}

function BookingForm({ onSubmit }: BookingFormProps) {
  const { tokens: t } = useTheme()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [slot, setSlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a guest name.')
      return
    }
    if (slot == null) {
      setError('Pick a time slot.')
      return
    }
    const ok = onSubmit({
      name: trimmed,
      phone: phone.trim(),
      partySize: Math.max(1, Math.round(partySize)),
      at: slotAt(TIME_SLOTS[slot].h, TIME_SLOTS[slot].m),
    })
    if (ok) {
      setName('')
      setPhone('')
      setPartySize(2)
      setSlot(null)
      setError(null)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Guest name" value={name} onChange={setName} placeholder="e.g. Priya Nair" />
        <TextField label="Phone" value={phone} onChange={setPhone} placeholder="e.g. +91 98765 43210" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <NumberField label="Party size" value={partySize} min={1} onChange={setPartySize} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ fontFamily: t.descFont, color: t.inkSoft }}>
            Time slot
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Booking time slot">
            {TIME_SLOTS.map((s, i) => {
              const active = slot === i
              return (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSlot(i)
                    setError(null)
                  }}
                  className="px-2.5 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: active ? t.accent : '#FFFFFF',
                    color: active ? '#fff' : t.ink,
                    border: `1px solid ${active ? t.accent : t.ruleColor}`,
                    borderRadius: isHard(t) ? 0 : 999,
                    fontFamily: t.descFont,
                    outlineColor: t.accent,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={submit}>
          <Plus size={15} aria-hidden /> Add booking
        </Button>
        {error && (
          <span className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Quick add to waitlist ────────────────────────────────────────────────────
interface QuickWaitlistProps {
  defaultQuote: number
  onAdd: (input: { name: string; partySize: number; quotedMins: number }) => boolean
}

function QuickWaitlist({ defaultQuote, onAdd }: QuickWaitlistProps) {
  const { tokens: t } = useTheme()
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name.')
      return
    }
    const ok = onAdd({
      name: trimmed,
      partySize: Math.max(1, Math.round(partySize)),
      quotedMins: defaultQuote,
    })
    if (ok) {
      setName('')
      setPartySize(2)
      setError(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Guest name" value={name} onChange={setName} placeholder="Walk-in name" />
        <NumberField label="Party size" value={partySize} min={1} onChange={setPartySize} />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="gold" size="sm" onClick={submit}>
          <Plus size={15} aria-hidden /> Add to waitlist
        </Button>
        <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Quoting ~{defaultQuote}m
        </span>
        {error && (
          <span className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>
            {error}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: string }) {
  const { tokens: t } = useTheme()
  return (
    <div
      className="flex items-center justify-between gap-2 px-3.5 py-2.5"
      style={{ borderBottom: `1px solid ${t.ruleColor}` }}
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
        <Icon size={15} aria-hidden /> {title}
      </span>
      <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
        {count}
      </span>
    </div>
  )
}

// ── View ─────────────────────────────────────────────────────────────────────
export function Reservations() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()

  const [pickingId, setPickingId] = useState<string | null>(null)

  const tableById = useMemo(() => {
    const m = new Map<string, Table>()
    for (const tb of ops.state.tables) m.set(tb.id, tb)
    return m
  }, [ops.state.tables])

  const availableTables = useMemo(
    () => ops.state.tables.filter(tb => tb.status === 'available'),
    [ops.state.tables],
  )

  const reservations = useMemo(
    () =>
      [...ops.state.reservations].sort((a, b) => {
        const byStatus = RES_ORDER[a.status] - RES_ORDER[b.status]
        return byStatus !== 0 ? byStatus : a.at - b.at
      }),
    [ops.state.reservations],
  )

  const upcomingCount = useMemo(
    () => ops.state.reservations.filter(r => r.status === 'booked').length,
    [ops.state.reservations],
  )

  const waitlist = useMemo(
    () => [...ops.state.waitlist].sort((a, b) => a.addedAt - b.addedAt),
    [ops.state.waitlist],
  )

  const activeWaiting = useMemo(
    () => ops.state.waitlist.filter(w => w.status === 'waiting' || w.status === 'notified').length,
    [ops.state.waitlist],
  )

  // ── Reservation actions ──
  const chooseTable = (res: Reservation, table: Table) => {
    ops.seatReservation(res.id, table.id)
    setPickingId(null)
    push(`${res.name} seated at ${table.label}`, 'success')
  }
  const cancelRes = (res: Reservation) => {
    ops.setReservationStatus(res.id, 'cancelled')
    if (pickingId === res.id) setPickingId(null)
    push(`Cancelled ${res.name}’s booking`, 'info')
  }
  const noShowRes = (res: Reservation) => {
    ops.setReservationStatus(res.id, 'no-show')
    if (pickingId === res.id) setPickingId(null)
    push(`Marked ${res.name} as no-show`, 'info')
  }
  const completeRes = (res: Reservation) => {
    ops.setReservationStatus(res.id, 'completed')
    push(`${res.name}’s visit completed`, 'success')
  }

  const addBooking = (input: { name: string; phone: string; partySize: number; at: number }): boolean => {
    ops.addReservation({
      id: `res-${Date.now()}`,
      name: input.name,
      phone: input.phone,
      partySize: input.partySize,
      at: input.at,
      tableId: null,
      status: 'booked',
      createdAt: Date.now(),
    })
    push(`Booked ${input.name} · ${clockTime(input.at)}`, 'success')
    return true
  }

  // ── Waitlist actions ──
  const notify = (entry: WaitlistEntry) => {
    ops.setWaitStatus(entry.id, 'notified')
    push(`Notified ${entry.name} — table ready`, 'success')
  }
  const seatWait = (entry: WaitlistEntry) => {
    ops.setWaitStatus(entry.id, 'seated')
    push(`${entry.name} seated from waitlist`, 'success')
  }
  const removeWait = (entry: WaitlistEntry) => {
    ops.removeWaitlist(entry.id)
    push(`Removed ${entry.name} from waitlist`, 'info')
  }
  const addWait = (input: { name: string; partySize: number; quotedMins: number }): boolean => {
    ops.addWaitlist({
      id: `wait-${Date.now()}`,
      name: input.name,
      partySize: input.partySize,
      quotedMins: input.quotedMins,
      status: 'waiting',
      addedAt: Date.now(),
    })
    push(`Added ${input.name} to the waitlist`, 'success')
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Reservations &amp; Waitlist
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {upcomingCount} upcoming {upcomingCount === 1 ? 'booking' : 'bookings'}
          {activeWaiting > 0 && ` · ${activeWaiting} waiting`}
        </p>
      </div>

      {/* New booking */}
      <Panel title="New booking" subtitle="Reserve a table for a future guest">
        <BookingForm onSubmit={addBooking} />
      </Panel>

      {/* Today's reservations */}
      <Panel padded={false}>
        <SectionHead
          icon={CalendarClock}
          title="Today’s reservations"
          count={`${reservations.length} ${reservations.length === 1 ? 'booking' : 'bookings'}`}
        />
        {reservations.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={30} />}
            title="No reservations yet"
            description="Add a booking above and it will show up here, sorted by time."
          />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {reservations.map(res => (
              <ReservationRow
                key={res.id}
                res={res}
                table={res.tableId ? tableById.get(res.tableId) : undefined}
                availableTables={availableTables}
                picking={pickingId === res.id}
                onStartPick={setPickingId}
                onCancelPick={() => setPickingId(null)}
                onChooseTable={chooseTable}
                onCancel={cancelRes}
                onNoShow={noShowRes}
                onComplete={completeRes}
              />
            ))}
          </motion.div>
        )}
      </Panel>

      {/* Waitlist */}
      <Panel padded={false}>
        <SectionHead
          icon={ClipboardList}
          title="Waitlist"
          count={`${waitlist.length} ${waitlist.length === 1 ? 'group' : 'groups'}`}
        />
        <div className="px-3.5 pt-3.5 pb-1" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
          <QuickWaitlist defaultQuote={defaultQuote(activeWaiting)} onAdd={addWait} />
        </div>
        {waitlist.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={30} />}
            title="Waitlist is empty"
            description="Walk-ins added above will queue here, oldest first."
          />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {waitlist.map(entry => (
              <WaitRow
                key={entry.id}
                entry={entry}
                onNotify={notify}
                onSeat={seatWait}
                onRemove={removeWait}
              />
            ))}
          </motion.div>
        )}
      </Panel>
    </div>
  )
}
