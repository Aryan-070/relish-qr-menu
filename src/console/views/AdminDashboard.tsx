import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import {
  computeKpis,
  topItems,
  revenueTrend,
  peakHeatmap,
  categoryMix,
  busiestTables,
} from '../lib/analytics'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { BarChart } from '../charts/BarChart'
import { LineAreaChart } from '../charts/LineAreaChart'
import { DonutChart } from '../charts/DonutChart'
import { Heatmap } from '../charts/Heatmap'
import { fadeUp, stagger } from '../../animations/variants'
import { inr, inrCompact } from '../lib/format'
import { categoryColor } from './admin/CategoryColors'
import type { BusyTable } from '../lib/analytics'

export function AdminDashboard() {
  const { dateRange } = useViewCtx()
  const ops = useOpsStore()
  const orders = ops.state.orders
  const tableCount = ops.state.tables.length

  const kpis = useMemo(
    () => computeKpis(orders, dateRange.days, tableCount),
    [orders, dateRange.days, tableCount],
  )

  const trend = useMemo(
    () => revenueTrend(orders, dateRange.days).map(p => ({ label: p.label, value: p.revenue })),
    [orders, dateRange.days],
  )

  const heatCells = useMemo(
    () => peakHeatmap(orders, dateRange.days),
    [orders, dateRange.days],
  )

  const topBars = useMemo(
    () =>
      topItems(orders, dateRange.days, 8).map(item => ({
        label: item.name,
        value: item.qty,
        sub: inr(item.revenue),
      })),
    [orders, dateRange.days],
  )

  const mix = useMemo(() => categoryMix(orders, dateRange.days), [orders, dateRange.days])
  const mixSlices = useMemo(
    () => mix.map(c => ({ label: c.name, value: c.revenue, color: categoryColor(c.categoryId) })),
    [mix],
  )
  const mixTotal = useMemo(() => mix.reduce((s, c) => s + c.revenue, 0), [mix])

  const tables = useMemo(
    () => busiestTables(orders, dateRange.days, 8),
    [orders, dateRange.days],
  )

  const tableColumns: Column<BusyTable>[] = useMemo(
    () => [
      {
        key: 'tableId',
        header: 'Table',
        render: row => row.tableId,
        sortValue: row => row.tableId,
      },
      {
        key: 'orders',
        header: 'Orders',
        align: 'right',
        render: row => <span className="tabular-nums">{row.orders}</span>,
        sortValue: row => row.orders,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        align: 'right',
        render: row => <span className="tabular-nums">{inr(row.revenue)}</span>,
        sortValue: row => row.revenue,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 1 — KPI row */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3"
      >
        <KpiCard
          label="Revenue"
          value={inr(kpis.revenue)}
          delta={kpis.revenueDelta}
          spark={kpis.revenueSpark}
        />
        <KpiCard label="Orders" value={String(kpis.orders)} delta={kpis.ordersDelta} />
        <KpiCard label="Avg order value" value={inr(kpis.aov)} delta={kpis.aovDelta} />
        <KpiCard label="Covers" value={String(kpis.covers)} delta={kpis.coversDelta} />
        <KpiCard label="Table turnover" value={`${kpis.turnover.toFixed(1)}×`} />
      </motion.div>

      {/* 2 — Revenue trend */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Revenue trend" subtitle={dateRange.label}>
          <LineAreaChart
            data={trend}
            ariaLabel={`Revenue trend, ${dateRange.label}`}
            formatValue={inrCompact}
            height={220}
            color="#8B1024"
          />
        </Panel>
      </motion.div>

      {/* 3 — Peak hours */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Peak hours" subtitle="When orders land, by weekday × hour">
          <Heatmap cells={heatCells} ariaLabel="Order volume by weekday and hour" />
        </Panel>
      </motion.div>

      {/* 4 — Most ordered + Category mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Panel title="Most ordered" subtitle="Top items by quantity">
            <BarChart data={topBars} ariaLabel="Most ordered items by quantity" />
          </Panel>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Panel title="Category mix" subtitle="Revenue share by category">
            <DonutChart
              slices={mixSlices}
              ariaLabel="Revenue share by menu category"
              centerLabel="Revenue"
              centerValue={inrCompact(mixTotal)}
              formatValue={inrCompact}
            />
          </Panel>
        </motion.div>
      </div>

      {/* 5 — Busiest tables */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Busiest tables" subtitle={`Top tables · ${dateRange.label}`}>
          <DataTable
            columns={tableColumns}
            rows={tables}
            rowKey={row => row.tableId}
            initialSortKey="revenue"
            initialSortDir="desc"
            caption="Busiest tables by revenue"
            emptyLabel="No orders in this period"
          />
        </Panel>
      </motion.div>
    </div>
  )
}
