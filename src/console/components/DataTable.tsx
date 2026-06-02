import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { cn } from '../lib/format'

export interface Column<Row> {
  key: string
  header: string
  /** Cell renderer. */
  render: (row: Row) => ReactNode
  /** Sort accessor; omit to disable sorting on this column. */
  sortValue?: (row: Row) => number | string
  align?: 'left' | 'right' | 'center'
  width?: string
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  caption?: string
  initialSortKey?: string
  initialSortDir?: 'asc' | 'desc'
  emptyLabel?: string
  className?: string
}

/** Accessible, sortable table primitive used across reports & staff views. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  initialSortKey,
  initialSortDir = 'desc',
  emptyLabel = 'No data',
  className = '',
}: DataTableProps<Row>) {
  const { tokens: t } = useTheme()
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir)

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortValue) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [rows, columns, sortKey, sortDir])

  const toggleSort = (col: Column<Row>) => {
    if (!col.sortValue) return
    if (sortKey === col.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(col.key)
      setSortDir('desc')
    }
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
            {columns.map(col => {
              const sortable = !!col.sortValue
              const active = sortKey === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={{
                    width: col.width,
                    fontFamily: t.descFont,
                    color: t.inkSoft,
                    textAlign: col.align ?? 'left',
                  }}
                  className="py-2 px-2 text-[11px] uppercase tracking-wider font-semibold"
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      aria-label={`Sort by ${col.header}${active ? (sortDir === 'asc' ? ', ascending' : ', descending') : ''}`}
                      className={cn(
                        'inline-flex items-center gap-1 cursor-pointer hover:opacity-80',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                      style={{ color: active ? t.accent : 'inherit' }}
                    >
                      {col.header}
                      {active &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center" style={{ color: t.descColor, fontFamily: t.descFont }}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map(row => (
              <tr key={rowKey(row)} style={{ borderBottom: `1px solid ${t.ruleColor}` }} className="hover:bg-black/[0.02]">
                {columns.map(col => (
                  <td
                    key={col.key}
                    className="py-2.5 px-2"
                    style={{ textAlign: col.align ?? 'left', fontFamily: t.descFont, color: t.ink }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
