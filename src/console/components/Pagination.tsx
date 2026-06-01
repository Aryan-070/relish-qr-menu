import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { controlRadius, isHard } from '../lib/skin'
import { cn } from '../lib/format'

interface PaginationProps {
  page: number
  pageCount: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * Reusable, theme-aware pagination bar: range summary, page-size selector,
 * and Prev/Next controls. Buttons disable at bounds; everything is keyboard +
 * screen-reader accessible. Wraps gracefully on narrow viewports.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPage,
  onPageSize,
}: PaginationProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const sizeId = useId()

  const safePageCount = Math.max(1, pageCount)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  const atStart = page <= 1
  const atEnd = page >= safePageCount

  const navStyle = {
    borderRadius: hard ? 0 : 999,
    border: `1px solid ${t.ruleColor}`,
    background: '#FFFFFF',
    color: t.ink,
    fontFamily: t.descFont,
  } as const

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-[12px]"
      style={{ fontFamily: t.descFont, color: t.inkSoft }}
    >
      <p className="whitespace-nowrap">
        Showing <span style={{ color: t.ink, fontWeight: 600 }}>{first}</span>–
        <span style={{ color: t.ink, fontWeight: 600 }}>{last}</span> of{' '}
        <span style={{ color: t.ink, fontWeight: 600 }}>{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor={sizeId} className="whitespace-nowrap">
            Per page
          </label>
          <select
            id={sizeId}
            aria-label="Rows per page"
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            className="px-2 py-1 text-[12px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon"
            style={{
              borderRadius: controlRadius(t),
              border: `1px solid ${t.ruleColor}`,
              background: '#FFFFFF',
              color: t.ink,
              fontFamily: t.descFont,
            }}
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={atStart}
            aria-label="Previous page"
            className={cn(
              'inline-flex items-center justify-center w-8 h-8 transition-colors',
              atStart ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-80',
            )}
            style={navStyle}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>

          <span className="whitespace-nowrap" aria-live="polite">
            Page <span style={{ color: t.ink, fontWeight: 600 }}>{Math.min(page, safePageCount)}</span> /{' '}
            {safePageCount}
          </span>

          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={atEnd}
            aria-label="Next page"
            className={cn(
              'inline-flex items-center justify-center w-8 h-8 transition-colors',
              atEnd ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-80',
            )}
            style={navStyle}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  )
}
