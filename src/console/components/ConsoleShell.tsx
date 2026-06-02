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
  'admin-billing': 'Billing & Subscription',
  'waiter-tables': 'My Tables',
  'waiter-queue': 'Service Queue',
  'waiter-billing': 'Billing',
  kds: 'Kitchen Display',
  'table-qr': 'Table QR Codes',
  reservations: 'Reservations & Waitlist',
  loyalty: 'Loyalty & CRM',
  feedback: 'Guest Feedback',
  campaigns: 'Marketing Campaigns',
}

const RANGE_VIEWS: ConsoleView[] = ['admin-dashboard', 'reports', 'manager-staff']

interface ConsoleShellProps {
  role: Role
  onRole: (role: Role) => void
  /** Show the Admin/Manager/Waiter demo switcher. Hidden in real-auth mode. */
  showRoleSwitcher?: boolean
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
  showRoleSwitcher = true,
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
          showRoleSwitcher={showRoleSwitcher}
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
