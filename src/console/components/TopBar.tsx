import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { headingStyle } from '../lib/skin'
import { SegmentedControl } from './SegmentedControl'
import { ConfirmDialog } from './ConfirmDialog'
import { ROLE_LABEL } from '../nav'
import { DATE_RANGES, type DateRange, type Role } from '../lib/types'

interface TopBarProps {
  role: Role
  onRole: (role: Role) => void
  dateRange: DateRange
  onDateRange: (range: DateRange) => void
  viewTitle: string
  showDateRange: boolean
  onReset: () => void
}

const ROLE_OPTIONS = (['admin', 'manager', 'waiter'] as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }))
const RANGE_OPTIONS = DATE_RANGES.map(r => ({ value: String(r.days), label: `${r.days}d` }))

export function TopBar({ role, onRole, dateRange, onDateRange, viewTitle, showDateRange, onReset }: TopBarProps) {
  const { tokens: t } = useTheme()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <header
      className="shrink-0 h-16 px-4 sm:px-6 flex items-center gap-3 sm:gap-4"
      style={{ background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6', borderBottom: `1px solid ${t.ruleColor}` }}
    >
      <h1 className="text-[19px] sm:text-[22px] leading-none truncate min-w-0" style={headingStyle(t)}>
        {viewTitle}
      </h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
        {showDateRange && (
          <SegmentedControl
            ariaLabel="Date range"
            size="sm"
            options={RANGE_OPTIONS}
            value={String(dateRange.days)}
            onChange={v => onDateRange(DATE_RANGES.find(r => String(r.days) === v) ?? DATE_RANGES[0])}
          />
        )}

        <div className="flex items-center gap-1.5 pl-1">
          <span className="hidden sm:inline text-[10px] uppercase tracking-wider" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Demo as
          </span>
          <SegmentedControl
            ariaLabel="Switch demo role"
            size="sm"
            options={ROLE_OPTIONS}
            value={role}
            onChange={onRole}
          />
        </div>

        <button
          onClick={() => setConfirmReset(true)}
          title="Reset demo data"
          aria-label="Reset demo data"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5 shrink-0"
          style={{ color: t.inkSoft }}
        >
          <RotateCcw size={17} />
        </button>
      </div>

      {/* Role switcher for small screens (below the bar handled by parent scroll) */}
      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        message="This restores all tables, orders, menu edits, and bills to the original seeded demo. Your changes will be lost."
        confirmLabel="Reset"
        danger
        onConfirm={() => {
          onReset()
          setConfirmReset(false)
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </header>
  )
}
