import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { Avatar } from '../components/Avatar'
import { DataTable, type Column } from '../components/DataTable'
import { BarChart } from '../charts/BarChart'
import { staffPerformance } from '../lib/analytics'
import { fadeUp, stagger } from '../../animations/variants'
import { inr } from '../lib/format'
import type { Staff, StaffPerf } from '../lib/types'

export function StaffPerformance() {
  const { dateRange } = useViewCtx()
  const ops = useOpsStore()
  const orders = ops.state.orders
  const staff = ops.state.staff

  const rows = useMemo(
    () => staffPerformance(orders, staff, dateRange.days),
    [orders, staff, dateRange.days],
  )

  const staffById = useMemo(() => {
    const map = new Map<string, Staff>()
    for (const s of staff) map.set(s.id, s)
    return map
  }, [staff])

  const summary = useMemo(() => {
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
    const totalCovers = rows.reduce((s, r) => s + r.covers, 0)
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0)
    const top = rows[0] // staffPerformance returns sorted by revenue desc
    return {
      top,
      totalCovers,
      avgTicket: totalOrders ? totalRevenue / totalOrders : 0,
    }
  }, [rows])

  const revenueBars = useMemo(
    () => rows.map(r => ({ label: r.name, value: r.revenue })),
    [rows],
  )

  const columns: Column<StaffPerf>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Staff',
        sortValue: row => row.name,
        render: row => {
          const s = staffById.get(row.staffId)
          return (
            <span className="flex items-center gap-2">
              <Avatar name={row.name} hue={s?.hue} size={26} />
              <span>{row.name}</span>
            </span>
          )
        },
      },
      {
        key: 'orders',
        header: 'Orders',
        align: 'right',
        sortValue: row => row.orders,
        render: row => <span className="tabular-nums">{row.orders}</span>,
      },
      {
        key: 'covers',
        header: 'Covers',
        align: 'right',
        sortValue: row => row.covers,
        render: row => <span className="tabular-nums">{row.covers}</span>,
      },
      {
        key: 'avgTicket',
        header: 'Avg ticket',
        align: 'right',
        sortValue: row => row.avgTicket,
        render: row => <span className="tabular-nums">{inr(row.avgTicket)}</span>,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        align: 'right',
        sortValue: row => row.revenue,
        render: row => <span className="tabular-nums font-semibold">{inr(row.revenue)}</span>,
      },
    ],
    [staffById],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* KPI summary */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <KpiCard
          label="Top performer"
          value={summary.top ? summary.top.name : '—'}
        />
        <KpiCard label="Total covers" value={String(summary.totalCovers)} />
        <KpiCard label="Team avg ticket" value={inr(summary.avgTicket)} />
      </motion.div>

      {/* Revenue by waiter */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Revenue by waiter" subtitle={dateRange.label}>
          {revenueBars.length > 0 ? (
            <BarChart data={revenueBars} ariaLabel="Revenue by waiter" formatValue={inr} />
          ) : (
            <p className="text-[13px] py-6 text-center" style={{ color: 'var(--mute,#a89a8a)' }}>
              No orders in this period.
            </p>
          )}
        </Panel>
      </motion.div>

      {/* Sortable leaderboard */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Staff leaderboard" subtitle={`Performance · ${dateRange.label}`}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.staffId}
            initialSortKey="revenue"
            initialSortDir="desc"
            caption="Staff performance leaderboard"
            emptyLabel="No orders in this period"
          />
        </Panel>
      </motion.div>
    </div>
  )
}
