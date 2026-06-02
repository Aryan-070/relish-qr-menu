import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarClock,
  Plus,
  Trash2,
  Clock,
  LogIn,
  LogOut,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { SelectField } from '../components/Field'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { isHard } from '../lib/skin'
import { clockTime } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { Shift, Attendance, Staff } from '../lib/types'

const DAY_MS = 86_400_000

// Monday-anchored week labels for the grid columns.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

// ── Date helpers ─────────────────────────────────────────────────────────────
/** Midnight epoch-ms of the Monday for the week containing `now`. */
function weekMonday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=Sun … 6=Sat
  const mondayOffset = (dow + 6) % 7
  return d.getTime() - mondayOffset * DAY_MS
}

/** Midnight epoch-ms for a date, for matching a shift to a grid day. */
function dayKey(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "9am", "12pm", "4pm", "12am" from a 0–24 hour. */
function hourLabel(h: number): string {
  const hr = ((Math.floor(h) % 24) + 24) % 24
  const period = hr < 12 ? 'am' : 'pm'
  const display = hr % 12 === 0 ? 12 : hr % 12
  return `${display}${period}`
}

/** Hours elapsed since clock-in, one decimal (e.g. "3.4h"). */
function elapsedLabel(clockIn: number, now: number): string {
  const hrs = Math.max(0, (now - clockIn) / 3_600_000)
  return `${hrs.toFixed(1)}h`
}

/** Worked duration of a closed attendance record. */
function durationLabel(a: Attendance): string {
  if (a.clockOut == null) return '—'
  const hrs = Math.max(0, (a.clockOut - a.clockIn) / 3_600_000)
  return `${hrs.toFixed(1)}h`
}

// Hour options for the shift editor (whole hours, 0–24).
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => ({
  value: String(h),
  label: `${hourLabel(h)} (${String(h).padStart(2, '0')}:00)`,
}))

// ── Shift editor modal state ─────────────────────────────────────────────────
interface ShiftDraft {
  staffId: string
  dayIndex: number
  startHour: number
  endHour: number
}

// ── Section heading (mirrors Reservations) ───────────────────────────────────
function SectionHead({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: string }) {
  const { tokens: t } = useTheme()
  return (
    <div
      className="flex items-center justify-between gap-2 px-3.5 py-2.5"
      style={{ borderBottom: `1px solid ${t.ruleColor}` }}
    >
      <span
        className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider"
        style={{ color: t.inkSoft, fontFamily: t.descFont }}
      >
        <Icon size={15} aria-hidden /> {title}
      </span>
      <span className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
        {count}
      </span>
    </div>
  )
}

// ── Shift chip inside a grid cell ────────────────────────────────────────────
interface ShiftChipProps {
  shift: Shift
  onEdit: () => void
}
function ShiftChip({ shift, onEdit }: ShiftChipProps) {
  const { tokens: t } = useTheme()
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full inline-flex flex-col items-start px-2 py-1 text-left cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: 'rgba(217,160,58,0.12)',
        border: `1px solid rgba(217,160,58,0.45)`,
        borderRadius: isHard(t) ? 0 : 8,
        outlineColor: t.accent,
      }}
      title="Edit shift"
    >
      <span className="text-[11px] font-bold tabular-nums leading-tight" style={{ color: t.ink, fontFamily: t.descFont }}>
        {hourLabel(shift.startHour)}–{hourLabel(shift.endHour)}
      </span>
    </button>
  )
}

// ── View ─────────────────────────────────────────────────────────────────────
export function Roster() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()

  const now = useMemo(() => Date.now(), [])
  const monday = useMemo(() => weekMonday(now), [now])

  // Active staff only — deactivated members never appear on the roster.
  const staff = useMemo(
    () => ops.state.staff.filter(s => s.active),
    [ops.state.staff],
  )
  const staffById = useMemo(() => {
    const m = new Map<string, Staff>()
    for (const s of ops.state.staff) m.set(s.id, s)
    return m
  }, [ops.state.staff])

  // The seven day columns (Monday-anchored midnight timestamps).
  const days = useMemo(
    () => WEEKDAYS.map((label, i) => ({ label, key: monday + i * DAY_MS })),
    [monday],
  )

  // Index this week's shifts by `${staffId}|${dayKey}` for O(1) cell lookup.
  const shiftIndex = useMemo(() => {
    const m = new Map<string, Shift>()
    const weekEnd = monday + 7 * DAY_MS
    for (const s of ops.state.shifts) {
      if (s.date < monday || s.date >= weekEnd) continue
      m.set(`${s.staffId}|${dayKey(s.date)}`, s)
    }
    return m
  }, [ops.state.shifts, monday])

  const weekShiftCount = shiftIndex.size

  // Currently clocked-in (no clockOut), most recent first.
  const onFloor = useMemo(
    () =>
      ops.state.attendance
        .filter(a => a.clockOut == null)
        .sort((a, b) => b.clockIn - a.clockIn),
    [ops.state.attendance],
  )
  const onFloorIds = useMemo(() => new Set(onFloor.map(a => a.staffId)), [onFloor])

  // Recently clocked-out today, for the history strip.
  const recentlyOut = useMemo(
    () =>
      ops.state.attendance
        .filter(a => a.clockOut != null)
        .sort((a, b) => (b.clockOut ?? 0) - (a.clockOut ?? 0))
        .slice(0, 6),
    [ops.state.attendance],
  )

  // ── Shift editor modal ──
  const [editing, setEditing] = useState<{ existing: Shift | null; draft: ShiftDraft } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Shift | null>(null)

  const openNew = (staffId: string, dayIndex: number) => {
    const s = staffById.get(staffId)
    const am = s?.shift === 'AM'
    setEditing({
      existing: null,
      draft: { staffId, dayIndex, startHour: am ? 9 : 16, endHour: am ? 17 : 24 },
    })
  }

  const openEdit = (shift: Shift) => {
    const dayIndex = Math.max(0, Math.round((dayKey(shift.date) - monday) / DAY_MS))
    setEditing({
      existing: shift,
      draft: { staffId: shift.staffId, dayIndex, startHour: shift.startHour, endHour: shift.endHour },
    })
  }

  const setDraft = <K extends keyof ShiftDraft>(key: K, val: ShiftDraft[K]) =>
    setEditing(e => (e ? { ...e, draft: { ...e.draft, [key]: val } } : e))

  const saveShift = () => {
    if (!editing) return
    const { existing, draft } = editing
    const start = Math.max(0, Math.min(24, Math.round(draft.startHour)))
    const end = Math.max(0, Math.min(24, Math.round(draft.endHour)))
    if (end <= start) {
      push('End hour must be after start hour', 'info')
      return
    }
    const date = monday + draft.dayIndex * DAY_MS
    const member = staffById.get(draft.staffId)
    if (existing) {
      ops.updateShift(existing.id, { staffId: draft.staffId, date, startHour: start, endHour: end })
      push(`Updated ${member?.name ?? 'shift'} · ${WEEKDAYS[draft.dayIndex]}`, 'success')
    } else {
      ops.addShift({
        id: `shift-${Date.now().toString(36)}`,
        staffId: draft.staffId,
        date,
        startHour: start,
        endHour: end,
      })
      push(`Added ${member?.name ?? 'shift'} · ${WEEKDAYS[draft.dayIndex]}`, 'success')
    }
    setEditing(null)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const member = staffById.get(pendingDelete.staffId)
    ops.removeShift(pendingDelete.id)
    push(`Removed ${member?.name ?? 'shift'}`, 'info')
    setPendingDelete(null)
    setEditing(null)
  }

  // ── Clock in / out ──
  const clockIn = (s: Staff) => {
    ops.clockIn(s.id)
    push(`${s.name} clocked in`, 'success')
  }
  const clockOut = (s: Staff) => {
    ops.clockOut(s.id)
    push(`${s.name} clocked out`, 'info')
  }

  const staffOptions = useMemo(
    () => staff.map(s => ({ value: s.id, label: `${s.name} · ${s.role}` })),
    [staff],
  )
  const dayOptions = useMemo(
    () => WEEKDAYS.map((label, i) => ({ value: String(i), label })),
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Roster &amp; Attendance
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {weekShiftCount} {weekShiftCount === 1 ? 'shift' : 'shifts'} this week
          {onFloor.length > 0 && ` · ${onFloor.length} on the floor now`}
        </p>
      </div>

      {/* Weekly shift grid */}
      <Panel padded={false}>
        <SectionHead
          icon={CalendarClock}
          title="This week’s shifts"
          count={`Week of ${clockTimeDay(monday)}`}
        />
        {staff.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={30} />}
            title="No active staff"
            description="Activate staff in Staff Admin to schedule their shifts here."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Header row */}
              <div
                className="grid items-center px-3 py-2"
                style={{
                  gridTemplateColumns: `180px repeat(7, minmax(0, 1fr))`,
                  borderBottom: `1px solid ${t.ruleColor}`,
                  background: 'rgba(42,30,30,0.03)',
                }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                  Staff
                </span>
                {days.map(d => (
                  <span
                    key={d.key}
                    className="text-[11px] font-semibold uppercase tracking-wider text-center"
                    style={{ color: t.inkSoft, fontFamily: t.descFont }}
                  >
                    {d.label}
                  </span>
                ))}
              </div>

              {/* Staff rows */}
              <motion.div variants={stagger} initial="hidden" animate="visible">
                {staff.map(s => (
                  <motion.div
                    key={s.id}
                    variants={fadeUp}
                    className="grid items-center px-3 py-2"
                    style={{
                      gridTemplateColumns: `180px repeat(7, minmax(0, 1fr))`,
                      borderBottom: `1px solid ${t.ruleColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Avatar name={s.name} hue={s.hue} size={28} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                          {s.name}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider truncate" style={{ color: t.descColor, fontFamily: t.descFont }}>
                          {s.role} · {s.shift}
                          {onFloorIds.has(s.id) && (
                            <span className="ml-1" style={{ color: '#3d6130' }}>
                              ● on floor
                            </span>
                          )}
                        </span>
                      </span>
                    </div>

                    {days.map((d, di) => {
                      const shift = shiftIndex.get(`${s.id}|${d.key}`)
                      return (
                        <div key={d.key} className="px-1">
                          {shift ? (
                            <ShiftChip shift={shift} onEdit={() => openEdit(shift)} />
                          ) : (
                            <button
                              type="button"
                              onClick={() => openNew(s.id, di)}
                              aria-label={`Add shift for ${s.name} on ${d.label}`}
                              className="w-full inline-flex items-center justify-center py-1 cursor-pointer opacity-40 hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                              style={{
                                border: `1px dashed ${t.ruleColor}`,
                                borderRadius: isHard(t) ? 0 : 8,
                                color: t.inkSoft,
                                outlineColor: t.accent,
                              }}
                              title="Add shift"
                            >
                              <Plus size={13} aria-hidden />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* On the floor now */}
        <Panel padded={false}>
          <SectionHead
            icon={Clock}
            title="On the floor now"
            count={`${onFloor.length} clocked in`}
          />
          {onFloor.length === 0 ? (
            <EmptyState
              icon={<Timer size={30} />}
              title="Nobody clocked in"
              description="Clock a staff member in from the panel on the right."
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible">
              {onFloor.map(a => {
                const s = staffById.get(a.staffId)
                return (
                  <motion.div
                    key={a.id}
                    variants={fadeUp}
                    className="flex items-center gap-3 px-3.5 py-3"
                    style={{ borderBottom: `1px solid ${t.ruleColor}` }}
                  >
                    <Avatar name={s?.name ?? 'Staff'} hue={s?.hue ?? 350} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                          {s?.name ?? a.staffId}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: '#3d6130',
                            background: 'rgba(79,122,60,0.12)',
                            border: '1px solid rgba(79,122,60,0.40)',
                            borderRadius: isHard(t) ? 0 : 999,
                            fontFamily: t.descFont,
                          }}
                        >
                          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#3d6130' }} />
                          Live
                        </span>
                      </div>
                      <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: t.descColor, fontFamily: t.descFont }}>
                        In {clockTime(a.clockIn)} · {elapsedLabel(a.clockIn, now)} on shift
                      </div>
                    </div>
                    <Button variant="subtle" size="sm" onClick={() => s && clockOut(s)} disabled={!s}>
                      <LogOut size={14} aria-hidden /> Clock out
                    </Button>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {recentlyOut.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                Clocked out today
              </p>
              <div className="flex flex-col gap-1.5">
                {recentlyOut.map(a => {
                  const s = staffById.get(a.staffId)
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                      <span className="truncate" style={{ color: t.ink }}>{s?.name ?? a.staffId}</span>
                      <span className="tabular-nums shrink-0">
                        {clockTime(a.clockIn)}–{a.clockOut != null ? clockTime(a.clockOut) : '—'} · {durationLabel(a)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Clock-in panel */}
        <Panel title="Clock in / out" subtitle="Tap a staff member to start their shift">
          {staff.length === 0 ? (
            <EmptyState
              icon={<LogIn size={30} />}
              title="No active staff"
              description="Activate staff in Staff Admin to track attendance."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {staff.map(s => {
                const live = onFloorIds.has(s.id)
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{
                      border: `1px solid ${t.ruleColor}`,
                      borderRadius: isHard(t) ? 0 : 10,
                      background: live ? 'rgba(79,122,60,0.06)' : '#FFFFFF',
                    }}
                  >
                    <Avatar name={s.name} hue={s.hue} size={30} />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                        {s.name}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wider truncate" style={{ color: t.descColor, fontFamily: t.descFont }}>
                        {s.role} · {s.shift}
                      </span>
                    </div>
                    {live ? (
                      <Button variant="subtle" size="sm" onClick={() => clockOut(s)}>
                        <LogOut size={14} aria-hidden /> Out
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => clockIn(s)}>
                        <LogIn size={14} aria-hidden /> In
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Shift add / edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.existing ? 'Edit shift' : 'Add shift'}
        footer={
          <>
            {editing?.existing && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => editing?.existing && setPendingDelete(editing.existing)}
              >
                <Trash2 size={13} aria-hidden /> Remove
              </Button>
            )}
            <Button variant="subtle" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={saveShift}>
              {editing?.existing ? 'Save' : 'Add shift'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <SelectField
              label="Staff member"
              value={editing.draft.staffId}
              onChange={v => setDraft('staffId', v)}
              options={staffOptions}
            />
            <SelectField
              label="Day"
              value={String(editing.draft.dayIndex)}
              onChange={v => setDraft('dayIndex', Number(v))}
              options={dayOptions}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Start"
                value={String(editing.draft.startHour)}
                onChange={v => setDraft('startHour', Number(v))}
                options={HOUR_OPTIONS}
              />
              <SelectField
                label="End"
                value={String(editing.draft.endHour)}
                onChange={v => setDraft('endHour', Number(v))}
                options={HOUR_OPTIONS}
              />
            </div>
            <NumberFieldHint />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove shift?"
        message={
          pendingDelete
            ? `${staffById.get(pendingDelete.staffId)?.name ?? 'This shift'}’s shift will be removed from the roster.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// Small inline note under the shift editor (kept separate so the modal body
// stays readable). Uses theme tokens for color.
function NumberFieldHint() {
  const { tokens: t } = useTheme()
  return (
    <p className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
      Hours use a 24-hour clock (e.g. 16:00 = 4pm). End must be after start.
    </p>
  )
}

// "2 Jun" style label for the week-of header.
function clockTimeDay(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
