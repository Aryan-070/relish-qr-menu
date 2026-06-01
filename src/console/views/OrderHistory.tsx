import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, History, Printer, Search } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { DataTable, type Column } from '../components/DataTable'
import { SegmentedControl } from '../components/SegmentedControl'
import { SelectField } from '../components/Field'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { cn, inr, clockTime, ago } from '../lib/format'
import { fadeIn } from '../../animations/variants'
import type { StatusStyle } from '../lib/statusColors'
import type { OrderRecord } from '../lib/types'
import { downloadCsv } from './manager/csv'

type StatusFilter = 'all' | 'paid' | 'unpaid'
type RangeFilter = 'all' | 'today' | '7d' | '30d'

const PAID_STYLE: StatusStyle = {
  label: 'Paid',
  fg: '#3d6130',
  tint: 'rgba(79,122,60,0.12)',
  ring: 'rgba(79,122,60,0.4)',
}
const UNPAID_STYLE: StatusStyle = {
  label: 'Open',
  fg: '#8B1024',
  tint: 'rgba(139,16,36,0.10)',
  ring: 'rgba(139,16,36,0.4)',
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]
const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

const DAY_MS = 86_400_000

/** Lower bound (epoch ms) for a range filter, or null for "all". */
function rangeFloor(range: RangeFilter, now: number): number | null {
  if (range === 'all') return null
  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  if (range === '7d') return now - 7 * DAY_MS
  return now - 30 * DAY_MS
}

function itemCount(order: OrderRecord): number {
  return order.lines.reduce((sum, line) => sum + line.qty, 0)
}

/** Full readable timestamp for CSV / modal (e.g. "2 Jun 2026, 7:45 PM"). */
function fullTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function OrderHistory() {
  const { tokens: t } = useTheme()
  const { role, currentWaiterId } = useViewCtx()
  const ops = useOpsStore()
  const { orders, tables, staff } = ops.state

  const isWaiter = role === 'waiter'

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [range, setRange] = useState<RangeFilter>('all')
  const [waiterId, setWaiterId] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [detail, setDetail] = useState<OrderRecord | null>(null)

  // Stable lookups for table label + waiter name.
  const tableLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const table of tables) map.set(table.id, table.label)
    return (id: string) => map.get(id) ?? id
  }, [tables])

  const waiterName = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of staff) map.set(member.id, member.name)
    return (id: string) => map.get(id) ?? id
  }, [staff])

  const waiterOptions = useMemo(
    () => [
      { value: 'all', label: 'All waiters' },
      ...staff
        .filter(member => member.role === 'waiter')
        .map(member => ({ value: member.id, label: member.name })),
    ],
    [staff],
  )

  // Filter + sort pipeline (memoized). placedAt desc.
  const filtered = useMemo(() => {
    const now = Date.now()
    const floor = rangeFloor(range, now)
    const needle = query.trim().toLowerCase()

    const base = isWaiter ? orders.filter(o => o.waiterId === currentWaiterId) : orders

    return base
      .filter(o => {
        if (status === 'paid' && !o.paid) return false
        if (status === 'unpaid' && o.paid) return false
        if (floor !== null && o.placedAt < floor) return false
        if (!isWaiter && waiterId !== 'all' && o.waiterId !== waiterId) return false
        if (needle) {
          const haystack = [
            o.id.toLowerCase(),
            tableLabel(o.tableId).toLowerCase(),
            ...o.lines.map(line => line.name.toLowerCase()),
          ]
          if (!haystack.some(value => value.includes(needle))) return false
        }
        return true
      })
      .sort((a, b) => b.placedAt - a.placedAt)
  }, [orders, isWaiter, currentWaiterId, status, range, waiterId, query, tableLabel])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, pageCount)
  const pageRows = useMemo(
    () => filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [filtered, clampedPage, pageSize],
  )

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1)
  }, [query, status, range, waiterId, pageSize])

  const columns: Column<OrderRecord>[] = useMemo(() => {
    const cols: Column<OrderRecord>[] = [
      {
        key: 'time',
        header: 'Time',
        sortValue: o => o.placedAt,
        render: o => (
          <div className="leading-tight">
            <div style={{ color: t.ink, fontWeight: 600 }}>{clockTime(o.placedAt)}</div>
            <div className="text-[11px]" style={{ color: t.descColor }}>
              {ago(o.placedAt)}
            </div>
          </div>
        ),
      },
      {
        key: 'order',
        header: 'Order #',
        sortValue: o => o.id,
        render: o => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.id}</span>,
      },
      {
        key: 'table',
        header: 'Table',
        sortValue: o => tableLabel(o.tableId),
        render: o => tableLabel(o.tableId),
      },
      {
        key: 'waiter',
        header: 'Waiter',
        sortValue: o => waiterName(o.waiterId),
        render: o => waiterName(o.waiterId),
      },
      {
        key: 'items',
        header: 'Items',
        align: 'right',
        sortValue: o => itemCount(o),
        render: o => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{itemCount(o)}</span>,
      },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        sortValue: o => o.total,
        render: o => (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{inr(o.total)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: o => (o.paid ? 1 : 0),
        render: o => (
          <Badge status={o.paid ? PAID_STYLE : UNPAID_STYLE} label={o.paid ? 'Paid' : 'Open'} />
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: o => (
          <Button size="sm" variant="subtle" onClick={() => setDetail(o)} aria-label={`View order ${o.id}`}>
            View
          </Button>
        ),
      },
    ]
    return cols
  }, [t, tableLabel, waiterName])

  const handleExport = () => {
    const rows = filtered.map(o => [
      fullTime(o.placedAt),
      o.id,
      tableLabel(o.tableId),
      waiterName(o.waiterId),
      itemCount(o),
      o.total,
      o.paid ? 'Paid' : 'Open',
    ])
    downloadCsv(
      `relish-orders-${status}-${filtered.length}.csv`,
      ['Time', 'Order', 'Table', 'Waiter', 'Items', 'Total', 'Status'],
      rows,
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-[20px] sm:text-[24px] leading-tight" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}>
          Order History
        </h1>
        <p className="text-[13px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
          {isWaiter ? 'Your past orders.' : 'Browse, filter, and export every recorded order.'}
        </p>
      </header>

      {/* Toolbar */}
      <Panel className="no-print">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search
                size={15}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: t.descColor }}
              />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by order #, item, or table…"
                aria-label="Search orders"
                className="w-full pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon"
                style={{
                  borderRadius: 10,
                  border: `1px solid ${t.ruleColor}`,
                  background: '#FFFFFF',
                  color: t.ink,
                  fontFamily: t.descFont,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button size="sm" variant="subtle" onClick={handleExport} aria-label="Export filtered orders as CSV">
                <Download size={14} aria-hidden />
                Export CSV
              </Button>
              <Button size="sm" variant="subtle" onClick={handlePrint} aria-label="Print order history">
                <Printer size={14} aria-hidden />
                Print
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: t.descFont, color: t.inkSoft }}>
                Status
              </span>
              <SegmentedControl
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                ariaLabel="Filter by payment status"
                size="sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: t.descFont, color: t.inkSoft }}>
                Range
              </span>
              <SegmentedControl
                options={RANGE_OPTIONS}
                value={range}
                onChange={setRange}
                ariaLabel="Filter by date range"
                size="sm"
              />
            </div>
            {!isWaiter && (
              <div className="min-w-[160px]">
                <SelectField label="Waiter" value={waiterId} onChange={setWaiterId} options={waiterOptions} />
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Records */}
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<History size={28} aria-hidden />}
            title="No orders found"
            description="Try clearing the search box or widening the date range."
          />
        </Panel>
      ) : (
        <Panel>
          <div className={cn('print-area', '-mx-1')}>
            <DataTable
              columns={columns}
              rows={pageRows}
              rowKey={o => o.id}
              initialSortKey="time"
              initialSortDir="desc"
              caption="Order history records"
              emptyLabel="No orders on this page"
            />
          </div>
          <div className="no-print mt-4 pt-3" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
            <Pagination
              page={clampedPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        </Panel>
      )}

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail ? `Order ${detail.id}` : undefined} width={480}>
        {detail && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]" style={{ fontFamily: t.descFont }}>
              <Meta label="Table" value={tableLabel(detail.tableId)} t={t} />
              <Meta label="Waiter" value={waiterName(detail.waiterId)} t={t} />
              <Meta label="Placed" value={fullTime(detail.placedAt)} t={t} />
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] uppercase tracking-wider" style={{ color: t.inkSoft }}>
                  Status
                </dt>
                <dd>
                  <Badge
                    status={detail.paid ? PAID_STYLE : UNPAID_STYLE}
                    label={detail.paid ? 'Paid' : 'Open'}
                  />
                </dd>
              </div>
            </dl>

            <div style={{ borderTop: `1px solid ${t.ruleColor}` }} className="pt-3">
              <ul className="flex flex-col gap-2">
                {detail.lines.map((line, i) => (
                  <li
                    key={`${line.itemId}-${i}`}
                    className="flex items-baseline justify-between gap-3 text-[13px]"
                    style={{ fontFamily: t.descFont, color: t.ink }}
                  >
                    <span className="min-w-0">
                      <span style={{ color: t.inkSoft }}>{line.qty}×</span> {line.name}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{inr(line.price * line.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="flex items-baseline justify-between pt-3"
              style={{ borderTop: `1px solid ${t.ruleColor}` }}
            >
              <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ fontFamily: t.descFont, color: t.inkSoft }}>
                Total
              </span>
              <span className="text-[18px] font-semibold" style={{ fontFamily: t.headerFont, color: t.ink, fontVariantNumeric: 'tabular-nums' }}>
                {inr(detail.total)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}

interface MetaProps {
  label: string
  value: string
  t: ReturnType<typeof useTheme>['tokens']
}
function Meta({ label, value, t }: MetaProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[11px] uppercase tracking-wider" style={{ color: t.inkSoft }}>
        {label}
      </dt>
      <dd className="truncate" style={{ color: t.ink }}>
        {value}
      </dd>
    </div>
  )
}
