import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Receipt, Armchair } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NumberField } from '../components/Field'
import { SegmentedControl } from '../components/SegmentedControl'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { TABLE_STATUS } from '../lib/statusColors'
import { sectionTitleStyle, isHard } from '../lib/skin'
import { ago } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { Table, TableStatus } from '../lib/types'

// Status sub-states a waiter can flip an occupied table between.
type QuickStatus = 'seated' | 'ordering' | 'bill-requested'
const QUICK_OPTIONS: { value: QuickStatus; label: string }[] = [
  { value: 'seated', label: 'Seated' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'bill-requested', label: 'Bill' },
]

const SUMMARY_ITEMS: { key: TableStatus; label: string }[] = [
  { key: 'seated', label: 'Seated' },
  { key: 'ordering', label: 'Ordering' },
  { key: 'bill-requested', label: 'Bill requested' },
  { key: 'needs-attention', label: 'Needs attention' },
]

function SummaryStrip({ tables }: { tables: Table[] }) {
  const { tokens: t } = useTheme()
  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = {
      available: 0,
      seated: 0,
      ordering: 0,
      'bill-requested': 0,
      'needs-attention': 0,
    }
    for (const tb of tables) c[tb.status] += 1
    return c
  }, [tables])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {SUMMARY_ITEMS.map(it => {
        const s = TABLE_STATUS[it.key]
        return (
          <div
            key={it.key}
            className="flex flex-col gap-1 px-3.5 py-3"
            style={{ background: s.tint, border: `1px solid ${s.ring}`, borderRadius: isHard(t) ? 0 : 12 }}
          >
            <span className="text-[26px] leading-none font-bold" style={{ color: s.fg, fontFamily: t.headerFont }}>
              {counts[it.key]}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: s.fg, fontFamily: t.descFont }}>
              {it.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface TableCardProps {
  table: Table
  onSeat: (table: Table) => void
  onStatus: (table: Table, status: TableStatus) => void
  onOpenBill: (table: Table) => void
  onClear: (table: Table) => void
}

function TableCard({ table, onSeat, onStatus, onOpenBill, onClear }: TableCardProps) {
  const { tokens: t } = useTheme()
  const available = table.status === 'available'
  const quickValue: QuickStatus =
    table.status === 'ordering' || table.status === 'bill-requested' ? table.status : 'seated'

  return (
    <motion.div variants={fadeUp}>
      <Panel className="h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[17px] leading-tight" style={sectionTitleStyle(t)}>
              {table.label}
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {table.zone} · {table.seats} seats
            </p>
          </div>
          <Badge status={TABLE_STATUS[table.status]} />
        </div>

        <div className="flex items-center gap-4 text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} aria-hidden /> {available ? 'No covers' : `${table.guests} covers`}
          </span>
          {!available && table.seatedAt != null && (
            <span className="opacity-80">Seated {ago(table.seatedAt)}</span>
          )}
        </div>

        {available ? (
          <div className="mt-auto">
            <Button variant="primary" size="md" fullWidth onClick={() => onSeat(table)}>
              <Users size={15} aria-hidden /> Seat guests
            </Button>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2.5">
            <SegmentedControl<QuickStatus>
              options={QUICK_OPTIONS}
              value={quickValue}
              onChange={v => onStatus(table, v)}
              ariaLabel={`Set ${table.label} status`}
              size="sm"
              className="w-full"
            />
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={() => onOpenBill(table)} className="flex-1">
                <Receipt size={14} aria-hidden /> Open bill
              </Button>
              <Button variant="subtle" size="sm" onClick={() => onClear(table)} aria-label={`Clear ${table.label}`}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </motion.div>
  )
}

export function WaiterTables() {
  const { tokens: t } = useTheme()
  const { currentWaiterId, focusBilling } = useViewCtx()
  const ops = useOpsStore()
  const { push } = useToast()

  const assigned = useMemo(
    () => ops.state.tables.filter(tb => tb.waiterId === currentWaiterId),
    [ops.state.tables, currentWaiterId],
  )
  const showingFallback = assigned.length === 0
  const visibleTables = useMemo(() => {
    if (!showingFallback) return assigned
    return ops.state.tables.filter(tb => tb.status !== 'available')
  }, [showingFallback, assigned, ops.state.tables])

  const [seatTarget, setSeatTarget] = useState<Table | null>(null)
  const [guestCount, setGuestCount] = useState(2)
  const [clearTarget, setClearTarget] = useState<Table | null>(null)

  const openSeat = (table: Table) => {
    setGuestCount(2)
    setSeatTarget(table)
  }

  const confirmSeat = () => {
    if (!seatTarget) return
    const guests = Math.max(1, Math.round(guestCount))
    ops.seatTable(seatTarget.id, guests, currentWaiterId)
    push(`${seatTarget.label} seated · ${guests} covers`, 'success')
    setSeatTarget(null)
  }

  const changeStatus = (table: Table, status: TableStatus) => {
    if (table.status === status) return
    ops.setTableStatus(table.id, status)
    push(`${table.label} → ${TABLE_STATUS[status].label}`, 'info')
  }

  const confirmClear = () => {
    if (!clearTarget) return
    ops.clearTable(clearTarget.id)
    push(`${clearTarget.label} cleared`, 'success')
    setClearTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          My Tables
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {showingFallback
            ? 'Showing all tables (none assigned to you in demo)'
            : `${assigned.length} ${assigned.length === 1 ? 'table' : 'tables'} assigned to you`}
        </p>
      </div>

      <SummaryStrip tables={visibleTables} />

      {visibleTables.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Armchair size={30} />}
            title="No tables to show"
            description="Tables you are assigned to will appear here once guests are seated."
          />
        </Panel>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {visibleTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onSeat={openSeat}
              onStatus={changeStatus}
              onOpenBill={tb => focusBilling(tb.id)}
              onClear={tb => setClearTarget(tb)}
            />
          ))}
        </motion.div>
      )}

      <Modal
        open={seatTarget != null}
        onClose={() => setSeatTarget(null)}
        title={seatTarget ? `Seat ${seatTarget.label}` : 'Seat table'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setSeatTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmSeat}>
              Confirm seating
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {seatTarget && (
            <p className="text-[13px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
              {seatTarget.zone} · {seatTarget.seats} seats available
            </p>
          )}
          <NumberField
            label="Guest count"
            value={guestCount}
            min={1}
            onChange={setGuestCount}
            hint="Number of covers being seated"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={clearTarget != null}
        title={clearTarget ? `Clear ${clearTarget.label}?` : 'Clear table?'}
        message="This frees the table and resets its covers. Any unpaid orders stay open in Billing."
        confirmLabel="Clear table"
        danger
        onConfirm={confirmClear}
        onCancel={() => setClearTarget(null)}
      />
    </div>
  )
}
