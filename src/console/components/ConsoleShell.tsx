import { type ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { type ConsoleView } from '../nav'
import type { DateRange, Role } from '../lib/types'

const VIEW_TITLE: Record<ConsoleView, string> = {
  'admin-dashboard': 'Overview',
  reports: 'Reports',
  records: 'Order History',
  'manager-floor': 'Floor',
  'manager-menu': 'Menu Management',
  'manager-staff': 'Staff Performance',
  'waiter-tables': 'My Tables',
  'waiter-queue': 'Service Queue',
  'waiter-billing': 'Billing',
}

const RANGE_VIEWS: ConsoleView[] = ['admin-dashboard', 'reports', 'manager-staff']

interface ConsoleShellProps {
  role: Role
  onRole: (role: Role) => void
  activeView: ConsoleView
  onNavigate: (view: ConsoleView) => void
  dateRange: DateRange
  onDateRange: (range: DateRange) => void
  onExit: () => void
  children: ReactNode
}

export function ConsoleShell({
  role,
  onRole,
  activeView,
  onNavigate,
  dateRange,
  onDateRange,
  onExit,
  children,
}: ConsoleShellProps) {
  const { tokens: t } = useTheme()
  const { state, resetDemoData } = useOpsStore()
  const pendingCount = state.requests.filter(r => r.status === 'pending').length

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: t.bg }}>
      <Sidebar
        role={role}
        activeView={activeView}
        onNavigate={onNavigate}
        onExit={onExit}
        pendingCount={pendingCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          role={role}
          onRole={onRole}
          dateRange={dateRange}
          onDateRange={onDateRange}
          viewTitle={VIEW_TITLE[activeView]}
          showDateRange={RANGE_VIEWS.includes(activeView)}
          onReset={resetDemoData}
        />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">{children}</main>
      </div>
    </div>
  )
}
