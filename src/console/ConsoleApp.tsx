import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { OpsProvider } from './store/useOpsStore'
import { ToastProvider } from './components/Toast'
import { ConsoleShell } from './components/ConsoleShell'
import { ViewProvider, type ViewContextValue } from './ViewContext'
import { defaultViewFor, type ConsoleView } from './nav'
import { DATE_RANGES, type DateRange, type Role } from './lib/types'
import { fadeIn } from '../animations/variants'
import { AdminDashboard } from './views/AdminDashboard'
import { ReportsCenter } from './views/ReportsCenter'
import { FloorView } from './views/FloorView'
import { MenuManager } from './views/MenuManager'
import { StaffPerformance } from './views/StaffPerformance'
import { WaiterTables } from './views/WaiterTables'
import { ServiceQueue } from './views/ServiceQueue'
import { Billing } from './views/Billing'
import { OrderHistory } from './views/OrderHistory'

// The waiter whose perspective the waiter-role screens take.
const CURRENT_WAITER_ID = 'W1'

function renderView(view: ConsoleView) {
  switch (view) {
    case 'admin-dashboard':
      return <AdminDashboard />
    case 'reports':
      return <ReportsCenter />
    case 'manager-floor':
      return <FloorView />
    case 'manager-menu':
      return <MenuManager />
    case 'manager-staff':
      return <StaffPerformance />
    case 'waiter-tables':
      return <WaiterTables />
    case 'waiter-queue':
      return <ServiceQueue />
    case 'waiter-billing':
      return <Billing />
    case 'records':
      return <OrderHistory />
    default:
      return null
  }
}

interface ConsoleAppProps {
  onExit: () => void
}

export function ConsoleApp({ onExit }: ConsoleAppProps) {
  const [role, setRole] = useState<Role>('admin')
  const [activeView, setActiveView] = useState<ConsoleView>(defaultViewFor('admin'))
  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGES[0])
  const [billingFocusTableId, setBillingFocusTableId] = useState<string | null>(null)

  const navigate = useCallback((v: ConsoleView) => setActiveView(v), [])

  const handleRole = useCallback((r: Role) => {
    setRole(r)
    setActiveView(defaultViewFor(r))
  }, [])

  const focusBilling = useCallback((tableId: string) => {
    setBillingFocusTableId(tableId)
    setActiveView('waiter-billing')
  }, [])

  const viewCtx = useMemo<ViewContextValue>(
    () => ({ role, dateRange, currentWaiterId: CURRENT_WAITER_ID, navigate, billingFocusTableId, focusBilling }),
    [role, dateRange, billingFocusTableId, navigate, focusBilling],
  )

  return (
    <OpsProvider>
      <ToastProvider>
        <ViewProvider value={viewCtx}>
          <ConsoleShell
            role={role}
            onRole={handleRole}
            activeView={activeView}
            onNavigate={navigate}
            dateRange={dateRange}
            onDateRange={setDateRange}
            onExit={onExit}
          >
            <AnimatePresence mode="wait">
              <motion.div key={activeView} variants={fadeIn} initial="hidden" animate="visible" exit="exit">
                {renderView(activeView)}
              </motion.div>
            </AnimatePresence>
          </ConsoleShell>
        </ViewProvider>
      </ToastProvider>
    </OpsProvider>
  )
}
