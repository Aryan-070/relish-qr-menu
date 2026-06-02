import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Printer } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { DataTable, type Column } from '../components/DataTable'
import { BarChart } from '../charts/BarChart'
import { LineAreaChart } from '../charts/LineAreaChart'
import { DonutChart } from '../charts/DonutChart'
import { Heatmap } from '../charts/Heatmap'
import {
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  categoryMix,
  peakHeatmap,
  revenueTrend,
  staffPerformance,
  topItems,
} from '../lib/analytics'
import {
  ordersInRange,
} from '../lib/analytics'
import { fadeUp, stagger } from '../../animations/variants'
import { cn, inr, inrCompact } from '../lib/format'
import { panelStyle } from '../lib/skin'
import { downloadCsv } from './manager/csv'
import { managerCategoryColor } from './manager/categoryColors'
import { REPORTS, type ReportId } from './manager/reportTypes'
import {
  computeLineItemsTax,
  DEFAULT_GST_RATE_PCT,
  DEFAULT_TAX_CONFIG,
  type TaxLineItem,
} from '../../lib/tax'
import type {
  CategorySlice,
  EditableMenuItem,
  OrderRecord,
  StaffPerf,
  TopItem,
  TrendPoint,
} from '../lib/types'

/** Tabular payload for the active report — drives both the table and CSV export. */
interface ReportTable {
  columns: string[]
  rows: Array<Array<string | number>>
}

/** One row of the GST report: a single tax slab with its split liability. */
interface GstSlabRow {
  /** Full GST rate for this slab, e.g. 5 or 18. */
  ratePct: number
  /** Net (pre-tax) sales taxed at this slab, in whole rupees. */
  taxable: number
  /** CGST liability (half the GST for intra-state), in whole rupees. */
  cgst: number
  /** SGST liability (the other half), in whole rupees. */
  sgst: number
  /** Total GST (cgst + sgst), in whole rupees. */
  tax: number
}

/**
 * Group sold line items by their per-item GST slab and compute the CGST/SGST
 * split + taxable base for each, reusing the pure {@link computeLineItemsTax}
 * engine. Only revenue-bearing orders (paid, not voided, not comped) contribute.
 *
 * The per-item rate falls back to {@link DEFAULT_GST_RATE_PCT} (5%) when the
 * menu item has no explicit `taxRatePct` — matching the engine's own fallback.
 */
function gstByRate(
  orders: readonly OrderRecord[],
  menu: readonly EditableMenuItem[],
): GstSlabRow[] {
  const rateById = new Map<string, number>()
  for (const item of menu) {
    rateById.set(item.id, item.taxRatePct ?? DEFAULT_GST_RATE_PCT)
  }

  // Collect line amounts bucketed by their effective GST rate.
  const linesByRate = new Map<number, TaxLineItem[]>()
  for (const order of orders) {
    if (order.voided || order.comp || !order.paid) continue
    for (const line of order.lines) {
      const ratePct = rateById.get(line.itemId) ?? DEFAULT_GST_RATE_PCT
      const amount = line.price * line.qty
      const bucket = linesByRate.get(ratePct)
      if (bucket) {
        bucket.push({ amount, ratePct })
      } else {
        linesByRate.set(ratePct, [{ amount, ratePct }])
      }
    }
  }

  const rows: GstSlabRow[] = []
  for (const [ratePct, items] of linesByRate) {
    const breakdown = computeLineItemsTax(items, DEFAULT_TAX_CONFIG)
    const cgst = breakdown.components
      .filter(c => c.label === 'CGST')
      .reduce((s, c) => s + c.amount, 0)
    const sgst = breakdown.components
      .filter(c => c.label === 'SGST')
      .reduce((s, c) => s + c.amount, 0)
    rows.push({
      ratePct,
      taxable: breakdown.taxableBase,
      cgst,
      sgst,
      tax: breakdown.taxTotal,
    })
  }

  return rows.sort((a, b) => a.ratePct - b.ratePct)
}

export function ReportsCenter() {
  const { tokens: t } = useTheme()
  const { dateRange } = useViewCtx()
  const ops = useOpsStore()
  const orders = ops.state.orders
  const staff = ops.state.staff
  const menu = ops.state.menu

  const [selected, setSelected] = useState<ReportId>(REPORTS[0].id)

  const trend = useMemo(() => revenueTrend(orders, dateRange.days), [orders, dateRange.days])
  const items = useMemo(() => topItems(orders, dateRange.days, 15), [orders, dateRange.days])
  const heat = useMemo(() => peakHeatmap(orders, dateRange.days), [orders, dateRange.days])
  const staffRows = useMemo(
    () => staffPerformance(orders, staff, dateRange.days),
    [orders, staff, dateRange.days],
  )
  const mix = useMemo(() => categoryMix(orders, dateRange.days), [orders, dateRange.days])
  const mixTotal = useMemo(() => mix.reduce((s, c) => s + c.revenue, 0), [mix])

  // GST liability by slab over sold (paid, non-voided/comp) line items in range.
  const gstRows = useMemo(
    () => gstByRate(ordersInRange(orders, dateRange.days), menu),
    [orders, menu, dateRange.days],
  )
  const gstTotals = useMemo(
    () =>
      gstRows.reduce(
        (acc, r) => ({
          taxable: acc.taxable + r.taxable,
          cgst: acc.cgst + r.cgst,
          sgst: acc.sgst + r.sgst,
          tax: acc.tax + r.tax,
        }),
        { taxable: 0, cgst: 0, sgst: 0, tax: 0 },
      ),
    [gstRows],
  )

  // Busiest weekday / hour for the Peak Hours caption.
  const busiest = useMemo(() => {
    const peak = heat.reduce(
      (best, c) => (c.count > best.count ? c : best),
      { day: 0, hour: 0, count: 0 },
    )
    if (peak.count === 0) return null
    const hourLabel =
      peak.hour === 12 ? '12pm' : peak.hour < 12 ? `${peak.hour}am` : `${peak.hour - 12}pm`
    return { day: HEATMAP_DAYS[peak.day] ?? '—', hour: hourLabel, count: peak.count }
  }, [heat])

  // Tabular payload for the active report (table + CSV share this).
  const reportTable: ReportTable = useMemo(() => {
    switch (selected) {
      case 'daily-sales':
        return {
          columns: ['Date', 'Orders', 'Revenue'],
          rows: trend.map((p: TrendPoint) => [p.label, p.orders, Math.round(p.revenue)]),
        }
      case 'item-performance':
        return {
          columns: ['Item', 'Qty', 'Revenue'],
          rows: items.map((i: TopItem) => [i.name, i.qty, Math.round(i.revenue)]),
        }
      case 'peak-hours':
        return {
          columns: ['Day', ...HEATMAP_HOURS.map(h => `${h}:00`)],
          rows: HEATMAP_DAYS.map((day, di) => [
            day,
            ...HEATMAP_HOURS.map(
              h => heat.find(c => c.day === di && c.hour === h)?.count ?? 0,
            ),
          ]),
        }
      case 'waiter-productivity':
        return {
          columns: ['Waiter', 'Orders', 'Covers', 'Avg ticket', 'Revenue'],
          rows: staffRows.map((r: StaffPerf) => [
            r.name,
            r.orders,
            r.covers,
            Math.round(r.avgTicket),
            Math.round(r.revenue),
          ]),
        }
      case 'category-mix':
        return {
          columns: ['Category', 'Qty', 'Revenue', 'Share %'],
          rows: mix.map((c: CategorySlice) => [
            c.name,
            c.qty,
            Math.round(c.revenue),
            mixTotal ? `${((c.revenue / mixTotal) * 100).toFixed(1)}%` : '0%',
          ]),
        }
      case 'gst':
        return {
          columns: ['GST slab', 'Taxable', 'CGST', 'SGST', 'Total GST'],
          rows: [
            ...gstRows.map((r: GstSlabRow) => [
              `${r.ratePct}%`,
              r.taxable,
              r.cgst,
              r.sgst,
              r.tax,
            ]),
            ...(gstRows.length > 0
              ? [['Total', gstTotals.taxable, gstTotals.cgst, gstTotals.sgst, gstTotals.tax]]
              : []),
          ],
        }
      default:
        return { columns: [], rows: [] }
    }
  }, [selected, trend, items, heat, staffRows, mix, mixTotal, gstRows, gstTotals])

  const activeMeta = REPORTS.find(r => r.id === selected) ?? REPORTS[0]

  const handleExport = () => {
    downloadCsv(
      `relish-${activeMeta.slug}-${dateRange.days}d.csv`,
      reportTable.columns,
      reportTable.rows,
    )
  }

  const handlePrint = () => window.print()

  return (
    <div className="flex flex-col gap-4">
      {/* Report catalog */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 no-print"
      >
        {REPORTS.map(report => {
          const active = report.id === selected
          const Icon = report.icon
          return (
            <motion.button
              key={report.id}
              variants={fadeUp}
              type="button"
              onClick={() => setSelected(report.id)}
              aria-pressed={active}
              className="text-left p-3.5 flex flex-col gap-1.5 cursor-pointer transition-shadow"
              style={{
                ...panelStyle(t),
                borderColor: active ? t.accent : undefined,
                boxShadow: active ? `0 0 0 1px ${t.accent}` : panelStyle(t).boxShadow,
              }}
            >
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-0.5"
                style={{
                  background: active ? t.accent : 'rgba(42,30,30,0.06)',
                  color: active ? '#fff' : t.inkSoft,
                }}
              >
                <Icon size={16} aria-hidden />
              </span>
              <span
                className="text-[13px] font-semibold leading-tight"
                style={{ fontFamily: t.titleFont, color: t.ink }}
              >
                {report.title}
              </span>
              <span
                className="text-[11px] leading-snug"
                style={{ fontFamily: t.descFont, color: t.descColor }}
              >
                {report.description}
              </span>
            </motion.button>
          )
        })}
      </motion.div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <h2
          className="text-[15px]"
          style={{ fontFamily: t.titleFont, color: t.ink, fontWeight: t.titleWeight }}
        >
          {activeMeta.title} · {dateRange.label}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={handleExport} aria-label="Export report as CSV">
            <Download size={14} aria-hidden /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} aria-label="Print report">
            <Printer size={14} aria-hidden /> Print
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="print-area flex flex-col gap-4">
        {selected === 'daily-sales' && (
          <DailySales trend={trend} label={dateRange.label} table={reportTable} />
        )}
        {selected === 'item-performance' && (
          <ItemPerformance items={items} label={dateRange.label} table={reportTable} />
        )}
        {selected === 'peak-hours' && (
          <PeakHours
            cells={heat}
            busiest={busiest}
            label={dateRange.label}
          />
        )}
        {selected === 'waiter-productivity' && (
          <WaiterProductivity rows={staffRows} label={dateRange.label} table={reportTable} />
        )}
        {selected === 'category-mix' && (
          <CategoryMix mix={mix} total={mixTotal} label={dateRange.label} table={reportTable} />
        )}
        {selected === 'gst' && (
          <GstReport rows={gstRows} totals={gstTotals} label={dateRange.label} />
        )}
      </div>
    </div>
  )
}

/* ── Report previews ─────────────────────────────────────────────────────── */

function genericColumns(table: ReportTable): Column<Array<string | number>>[] {
  return table.columns.map((header, i) => ({
    key: `c${i}`,
    header,
    align: i === 0 ? 'left' : 'right',
    render: (row: Array<string | number>) => {
      const cell = row[i]
      const isMoney = header.toLowerCase().includes('revenue') || header.toLowerCase().includes('ticket')
      return (
        <span className={cn(i > 0 && 'tabular-nums')}>
          {isMoney && typeof cell === 'number' ? inr(cell) : cell}
        </span>
      )
    },
    sortValue: (row: Array<string | number>) => row[i],
  }))
}

function GenericTable({ table, caption }: { table: ReportTable; caption: string }) {
  const columns = useMemo(() => genericColumns(table), [table])
  return (
    <DataTable
      columns={columns}
      rows={table.rows}
      rowKey={row => String(row[0])}
      caption={caption}
      emptyLabel="No data in this period"
    />
  )
}

function DailySales({
  trend,
  label,
  table,
}: {
  trend: TrendPoint[]
  label: string
  table: ReportTable
}) {
  const lineData = useMemo(() => trend.map(p => ({ label: p.label, value: p.revenue })), [trend])
  return (
    <>
      <Panel title="Revenue trend" subtitle={label}>
        <LineAreaChart
          data={lineData}
          ariaLabel={`Daily revenue, ${label}`}
          formatValue={inrCompact}
          height={220}
          color="#8B1024"
        />
      </Panel>
      <Panel title="Daily breakdown">
        <GenericTable table={table} caption="Daily sales breakdown" />
      </Panel>
    </>
  )
}

function ItemPerformance({
  items,
  label,
  table,
}: {
  items: TopItem[]
  label: string
  table: ReportTable
}) {
  const bars = useMemo(
    () => items.map(i => ({ label: i.name, value: i.qty, sub: inr(i.revenue) })),
    [items],
  )
  return (
    <>
      <Panel title="Top items" subtitle={`By quantity · ${label}`}>
        <BarChart data={bars} ariaLabel="Item performance by quantity" />
      </Panel>
      <Panel title="Item breakdown">
        <GenericTable table={table} caption="Item performance breakdown" />
      </Panel>
    </>
  )
}

function PeakHours({
  cells,
  busiest,
  label,
}: {
  cells: ReturnType<typeof peakHeatmap>
  busiest: { day: string; hour: string; count: number } | null
  label: string
}) {
  return (
    <Panel
      title="Peak hours"
      subtitle={
        busiest
          ? `Busiest: ${busiest.day} at ${busiest.hour} (${busiest.count} orders) · ${label}`
          : `No orders in this period · ${label}`
      }
    >
      <Heatmap cells={cells} ariaLabel="Order volume by weekday and hour" />
    </Panel>
  )
}

function WaiterProductivity({
  rows,
  label,
  table,
}: {
  rows: StaffPerf[]
  label: string
  table: ReportTable
}) {
  const bars = useMemo(
    () => rows.map(r => ({ label: r.name, value: r.revenue })),
    [rows],
  )
  return (
    <>
      <Panel title="Productivity" subtitle={label}>
        <GenericTable table={table} caption="Waiter productivity breakdown" />
      </Panel>
      <Panel title="Revenue by waiter">
        {bars.length > 0 ? (
          <BarChart data={bars} ariaLabel="Revenue by waiter" formatValue={inr} />
        ) : (
          <p className="text-[13px] py-6 text-center" style={{ color: 'var(--mute,#a89a8a)' }}>
            No orders in this period.
          </p>
        )}
      </Panel>
    </>
  )
}

function CategoryMix({
  mix,
  total,
  label,
  table,
}: {
  mix: CategorySlice[]
  total: number
  label: string
  table: ReportTable
}) {
  const slices = useMemo(
    () => mix.map(c => ({ label: c.name, value: c.revenue, color: managerCategoryColor(c.categoryId) })),
    [mix],
  )
  return (
    <>
      <Panel title="Category mix" subtitle={`Revenue share · ${label}`}>
        <DonutChart
          slices={slices}
          ariaLabel="Revenue share by menu category"
          centerLabel="Revenue"
          centerValue={inrCompact(total)}
          formatValue={inrCompact}
        />
      </Panel>
      <Panel title="Category breakdown">
        <GenericTable table={table} caption="Category mix breakdown" />
      </Panel>
    </>
  )
}

function GstReport({
  rows,
  totals,
  label,
}: {
  rows: GstSlabRow[]
  totals: { taxable: number; cgst: number; sgst: number; tax: number }
  label: string
}) {
  const columns = useMemo<Column<GstSlabRow>[]>(
    () => [
      {
        key: 'slab',
        header: 'GST slab',
        align: 'left',
        render: (r: GstSlabRow) => <span className="font-semibold">{r.ratePct}%</span>,
        sortValue: (r: GstSlabRow) => r.ratePct,
      },
      {
        key: 'taxable',
        header: 'Taxable',
        align: 'right',
        render: (r: GstSlabRow) => <span className="tabular-nums">{inr(r.taxable)}</span>,
        sortValue: (r: GstSlabRow) => r.taxable,
      },
      {
        key: 'cgst',
        header: 'CGST',
        align: 'right',
        render: (r: GstSlabRow) => <span className="tabular-nums">{inr(r.cgst)}</span>,
        sortValue: (r: GstSlabRow) => r.cgst,
      },
      {
        key: 'sgst',
        header: 'SGST',
        align: 'right',
        render: (r: GstSlabRow) => <span className="tabular-nums">{inr(r.sgst)}</span>,
        sortValue: (r: GstSlabRow) => r.sgst,
      },
      {
        key: 'tax',
        header: 'Total GST',
        align: 'right',
        render: (r: GstSlabRow) => <span className="tabular-nums font-semibold">{inr(r.tax)}</span>,
        sortValue: (r: GstSlabRow) => r.tax,
      },
    ],
    [],
  )

  return (
    <>
      <Panel
        title="GST summary"
        subtitle={
          rows.length > 0
            ? `CGST + SGST liability by slab · ${label}`
            : `No taxable sales in this period · ${label}`
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <GstStat label="Taxable" value={totals.taxable} />
          <GstStat label="CGST" value={totals.cgst} />
          <GstStat label="SGST" value={totals.sgst} />
          <GstStat label="Total GST" value={totals.tax} emphasize />
        </div>
      </Panel>
      <Panel title="GST by slab">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => String(r.ratePct)}
          caption="GST liability by tax slab"
          emptyLabel="No taxable sales in this period"
        />
      </Panel>
    </>
  )
}

function GstStat({
  label,
  value,
  emphasize,
}: {
  label: string
  value: number
  emphasize?: boolean
}) {
  const { tokens: t } = useTheme()
  return (
    <div
      className="flex flex-col gap-1 p-3"
      style={{
        ...panelStyle(t),
        borderColor: emphasize ? t.accent : undefined,
      }}
    >
      <span
        className="text-[11px] uppercase tracking-wider"
        style={{ fontFamily: t.descFont, color: t.descColor }}
      >
        {label}
      </span>
      <span
        className="text-[18px] tabular-nums"
        style={{ fontFamily: t.priceFont, color: emphasize ? t.accent : t.ink, fontWeight: 700 }}
      >
        {inr(value)}
      </span>
    </div>
  )
}
