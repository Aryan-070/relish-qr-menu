import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Building2, Check } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { BarChart } from '../charts/BarChart'
import { fadeUp, stagger } from '../../animations/variants'
import { inr, inrCompact, cn } from '../lib/format'
import { controlRadius, isHard } from '../lib/skin'
import type { Outlet } from '../lib/types'

export function GroupDashboard() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const outlets = ops.state.outlets
  const setCurrentOutlet = ops.setCurrentOutlet

  // Group-wide rollup across every outlet — the headline KPIs.
  const totals = useMemo(() => {
    const revenue = outlets.reduce((s, o) => s + o.revenue, 0)
    const orders = outlets.reduce((s, o) => s + o.orders, 0)
    const staff = outlets.reduce((s, o) => s + o.staff, 0)
    const aov = orders > 0 ? Math.round(revenue / orders) : 0
    return { revenue, orders, staff, aov, count: outlets.length }
  }, [outlets])

  const current = useMemo(() => outlets.find(o => o.isCurrent) ?? null, [outlets])

  // Per-outlet revenue bars, sorted high→low; each bar gets a stable tint.
  const revenueBars = useMemo(
    () =>
      [...outlets]
        .sort((a, b) => b.revenue - a.revenue)
        .map(o => ({ label: o.name, value: o.revenue, sub: o.city })),
    [outlets],
  )

  const columns: Column<Outlet>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Outlet',
        sortValue: row => row.name,
        render: row => (
          <span className="flex items-center gap-2">
            <span className="truncate" style={{ color: t.ink, fontWeight: row.isCurrent ? 600 : 400 }}>
              {row.name}
            </span>
            {row.isCurrent && (
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 shrink-0"
                style={{
                  background: `${t.accent}1a`,
                  color: t.accent,
                  borderRadius: controlRadius(t),
                  fontFamily: t.descFont,
                }}
              >
                Current
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'city',
        header: 'City',
        sortValue: row => row.city,
        render: row => <span style={{ color: t.descColor }}>{row.city}</span>,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        align: 'right',
        sortValue: row => row.revenue,
        render: row => inr(row.revenue),
      },
      {
        key: 'orders',
        header: 'Orders',
        align: 'right',
        sortValue: row => row.orders,
        render: row => row.orders.toLocaleString('en-IN'),
      },
      {
        key: 'staff',
        header: 'Staff',
        align: 'right',
        sortValue: row => row.staff,
        render: row => row.staff,
      },
      {
        key: 'aov',
        header: 'Avg order',
        align: 'right',
        sortValue: row => (row.orders > 0 ? row.revenue / row.orders : 0),
        render: row => inr(row.orders > 0 ? row.revenue / row.orders : 0),
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* 1 — Group-wide KPI rollup */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3"
      >
        <KpiCard label="Group revenue" value={totals.revenue} format={inr} />
        <KpiCard label="Total orders" value={totals.orders} />
        <KpiCard label="Avg order value" value={totals.aov} format={inr} />
        <KpiCard label="Total staff" value={totals.staff} />
        <KpiCard label="Outlets" value={totals.count} />
      </motion.div>

      {/* 2 — Outlet switcher */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel
          title="Outlets"
          subtitle={current ? `Active: ${current.name} · ${current.city}` : 'Select an active outlet'}
        >
          <div className="flex flex-wrap gap-2">
            {outlets.map(o => {
              const active = o.isCurrent
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setCurrentOutlet(o.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-[13px] transition-colors cursor-pointer',
                  )}
                  style={{
                    borderRadius: controlRadius(t),
                    border: `1px solid ${active ? t.accent : t.ruleColor}`,
                    background: active ? `${t.accent}12` : 'transparent',
                    color: active ? t.accent : t.ink,
                    fontFamily: t.descFont,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {active ? <Check size={14} /> : <Building2 size={14} style={{ opacity: 0.6 }} />}
                  <span className="flex flex-col items-start leading-tight">
                    <span>{o.name}</span>
                    <span className="text-[11px]" style={{ color: t.descColor, fontWeight: 400 }}>
                      {o.city}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>
      </motion.div>

      {/* 3 — Per-outlet revenue + comparison table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Panel title="Revenue by outlet" subtitle="Lifetime revenue, highest first">
            <BarChart
              data={revenueBars}
              ariaLabel="Revenue by outlet"
              formatValue={inrCompact}
              color={t.accent}
            />
          </Panel>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Panel title="Outlet comparison" subtitle="Revenue, orders & staffing across the group">
            <DataTable
              columns={columns}
              rows={outlets}
              rowKey={o => o.id}
              initialSortKey="revenue"
              initialSortDir="desc"
              caption="Per-outlet comparison"
              emptyLabel={isHard(t) ? 'NO OUTLETS' : 'No outlets configured'}
            />
          </Panel>
        </motion.div>
      </div>
    </div>
  )
}
