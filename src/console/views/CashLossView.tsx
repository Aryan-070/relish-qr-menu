import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ReceiptText } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { Badge } from '../components/Badge'
import { SegmentedControl } from '../components/SegmentedControl'
import { EmptyState } from '../components/EmptyState'
import { inr, clockTime, ago } from '../lib/format'
import { fadeIn, stagger } from '../../animations/variants'
import type { StatusStyle } from '../lib/statusColors'
import type { AuditEntry, AuditType } from '../lib/types'

type AuditFilter = 'all' | AuditType

const AUDIT_FILTERS: { value: AuditFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'void', label: 'Voids' },
  { value: 'comp', label: 'Comps' },
  { value: 'discount', label: 'Discounts' },
  { value: 'merge', label: 'Merges' },
  { value: 'transfer', label: 'Transfers' },
]

// Per-type pill styling, derived from the brand status palette.
// Losses (void/comp/discount) skew maroon/gold; structural ops (merge/transfer)
// stay neutral so the eye is drawn to the money-leaking events.
const AUDIT_STYLE: Record<AuditType, StatusStyle> = {
  void: { label: 'Void', fg: '#b3141b', tint: 'rgba(215,25,32,0.12)', ring: 'rgba(215,25,32,0.45)' },
  comp: { label: 'Comp', fg: '#8B1024', tint: 'rgba(139,16,36,0.10)', ring: 'rgba(139,16,36,0.40)' },
  discount: { label: 'Discount', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  merge: { label: 'Merge', fg: '#4a3f3a', tint: 'rgba(74,63,58,0.10)', ring: 'rgba(74,63,58,0.32)' },
  transfer: { label: 'Transfer', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
}

const AUDIT_LABEL: Record<AuditType, string> = {
  void: 'Void',
  comp: 'Comp',
  discount: 'Discount',
  merge: 'Merge',
  transfer: 'Transfer',
}

interface LossKpis {
  voidCount: number
  voidAmount: number
  compCount: number
  compAmount: number
  discountCount: number
  discountAmount: number
}

export function CashLossView() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { auditLog, orders, tables, staff } = ops.state

  const [filter, setFilter] = useState<AuditFilter>('all')

  // Stable lookups for order total, table label, and staff name.
  const orderTotal = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) map.set(o.id, o.total)
    return (id?: string) => (id ? map.get(id) : undefined)
  }, [orders])

  const tableLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const tbl of tables) map.set(tbl.id, tbl.label)
    return (id?: string) => (id ? (map.get(id) ?? id) : undefined)
  }, [tables])

  const staffName = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of staff) map.set(member.id, member.name)
    return (id?: string) => (id ? (map.get(id) ?? id) : undefined)
  }, [staff])

  // The ₹ impact of an audit entry: an explicit amount wins; otherwise fall
  // back to the linked order total (so a void of an order counts that order's
  // value even when no amount was recorded).
  const entryAmount = (entry: AuditEntry): number => {
    if (typeof entry.amount === 'number') return entry.amount
    return orderTotal(entry.orderId) ?? 0
  }

  // KPI roll-up across the whole audit log (counts + ₹ amount per loss type).
  const kpis = useMemo<LossKpis>(() => {
    const k: LossKpis = {
      voidCount: 0,
      voidAmount: 0,
      compCount: 0,
      compAmount: 0,
      discountCount: 0,
      discountAmount: 0,
    }
    for (const entry of auditLog) {
      const amount = entryAmount(entry)
      if (entry.type === 'void') {
        k.voidCount += 1
        k.voidAmount += amount
      } else if (entry.type === 'comp') {
        k.compCount += 1
        k.compAmount += amount
      } else if (entry.type === 'discount') {
        k.discountCount += 1
        k.discountAmount += amount
      }
    }
    return k
    // entryAmount depends on orderTotal; auditLog + orders cover its inputs.
  }, [auditLog, orderTotal])

  const totalLossAmount = kpis.voidAmount + kpis.compAmount + kpis.discountAmount
  const totalLossCount = kpis.voidCount + kpis.compCount + kpis.discountCount

  const rows = useMemo(() => {
    const filtered =
      filter === 'all' ? auditLog : auditLog.filter(entry => entry.type === filter)
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  }, [auditLog, filter])

  const columns: Column<AuditEntry>[] = useMemo(
    () => [
      {
        key: 'time',
        header: 'Time',
        sortValue: e => e.createdAt,
        render: e => (
          <div className="leading-tight">
            <div style={{ color: t.ink, fontWeight: 600 }}>{clockTime(e.createdAt)}</div>
            <div className="text-[11px]" style={{ color: t.descColor }}>
              {ago(e.createdAt)}
            </div>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortValue: e => e.type,
        render: e => <Badge status={AUDIT_STYLE[e.type]} label={AUDIT_LABEL[e.type]} />,
      },
      {
        key: 'ref',
        header: 'Order / Table',
        sortValue: e => e.orderId ?? tableLabel(e.tableId) ?? '',
        render: e => {
          const order = e.orderId
          const table = tableLabel(e.tableId)
          if (!order && !table) {
            return <span style={{ color: t.descColor }}>—</span>
          }
          return (
            <div className="leading-tight">
              {order && (
                <div style={{ color: t.ink, fontVariantNumeric: 'tabular-nums' }}>{order}</div>
              )}
              {table && (
                <div className="text-[11px]" style={{ color: t.descColor }}>
                  {table}
                </div>
              )}
            </div>
          )
        },
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        sortValue: e => entryAmount(e),
        render: e => {
          const amount = entryAmount(e)
          if (amount <= 0) return <span style={{ color: t.descColor }}>—</span>
          return <span style={{ fontWeight: 600 }}>{inr(amount)}</span>
        },
      },
      {
        key: 'reason',
        header: 'Reason',
        render: e => <span style={{ color: t.ink }}>{e.reason || '—'}</span>,
      },
      {
        key: 'staff',
        header: 'Staff',
        sortValue: e => staffName(e.staffId) ?? '',
        render: e => staffName(e.staffId) ?? <span style={{ color: t.descColor }}>System</span>,
      },
    ],
    // entryAmount/tableLabel/staffName are derived from these inputs.
    [t, tableLabel, staffName, orderTotal],
  )

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1
          className="text-[20px] sm:text-[24px] leading-tight"
          style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}
        >
          Cash &amp; Loss
        </h1>
        <p className="text-[13px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
          Governance trail of every void, comp, and discount — who, what, and how much.
        </p>
      </header>

      {/* KPI strip — counts + ₹ leakage per loss category */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <KpiCard
          label={`Voids · ${kpis.voidCount}`}
          value={kpis.voidAmount}
          format={inr}
          goodWhenUp={false}
        />
        <KpiCard
          label={`Comps · ${kpis.compCount}`}
          value={kpis.compAmount}
          format={inr}
          goodWhenUp={false}
        />
        <KpiCard
          label={`Discounts · ${kpis.discountCount}`}
          value={kpis.discountAmount}
          format={inr}
          goodWhenUp={false}
        />
        <KpiCard
          label={`Total leakage · ${totalLossCount}`}
          value={totalLossAmount}
          format={inr}
          goodWhenUp={false}
        />
      </motion.div>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="text-[13px]"
          style={{ fontFamily: t.descFont, color: t.descColor }}
        >
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </span>
        <SegmentedControl
          options={AUDIT_FILTERS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter audit log by type"
          size="sm"
        />
      </div>

      {/* Audit log */}
      <Panel padded={rows.length === 0}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={28} aria-hidden />}
            title="No audit entries"
            description={
              filter === 'all'
                ? 'Voids, comps, and discounts will be logged here as staff record them.'
                : 'No entries of this type yet — try a different filter.'
            }
          />
        ) : (
          <div className="-mx-1">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={e => e.id}
              initialSortKey="time"
              initialSortDir="desc"
              caption="Cash and loss audit log"
              emptyLabel="No matching entries"
            />
          </div>
        )}
      </Panel>
    </motion.div>
  )
}
