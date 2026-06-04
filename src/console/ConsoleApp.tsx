import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ToastProvider } from './components/Toast'
import { ConsoleShell } from './components/ConsoleShell'
import { CommandPalette } from './components/CommandPalette'
import { ViewProvider, type ViewContextValue } from './ViewContext'
import { defaultViewFor, type ConsoleView } from './nav'
import { DATE_RANGES, type DateRange, type Role } from './lib/types'
import { fadeIn } from '../animations/variants'
import { AdminDashboard } from './views/AdminDashboard'
import { ReportsCenter } from './views/ReportsCenter'
import { FloorView } from './views/FloorView'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import { MenuManagerLive } from './views/MenuManagerLive'
import { StaffPerformance } from './views/StaffPerformance'
import { BillingView } from './views/BillingView'
import { WaiterTables } from './views/WaiterTables'
import { ServiceQueue } from './views/ServiceQueue'
import { Billing } from './views/Billing'
import { OrderHistory } from './views/OrderHistory'
import { KitchenDisplay } from './views/KitchenDisplay'
import { QrCodes } from './views/QrCodes'
import { Reservations } from './views/Reservations'
import { LoyaltyCrm } from './views/LoyaltyCrm'
import { FeedbackInbox } from './views/FeedbackInbox'
import { Campaigns } from './views/Campaigns'
import { Inventory } from './views/Inventory'
import { Promotions } from './views/Promotions'
import { CashLossView } from './views/CashLossView'
import { StaffAdmin } from './views/StaffAdmin'
import { Roster } from './views/Roster'
import { GroupDashboard } from './views/GroupDashboard'
import { useAuth } from './auth/AuthContext'
import { SignIn } from './auth/SignIn'

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
      return <MenuManagerLive />
    case 'manager-staff':
      return <StaffPerformance />
    case 'admin-billing':
      return <BillingView />
    case 'waiter-tables':
      return <WaiterTables />
    case 'waiter-queue':
      return <ServiceQueue />
    case 'waiter-billing':
      return <Billing />
    case 'records':
      return <OrderHistory />
    case 'kds':
      return <KitchenDisplay />
    case 'table-qr':
      return <QrCodes />
    case 'reservations':
      return <Reservations />
    case 'loyalty':
      return <LoyaltyCrm />
    case 'feedback':
      return <FeedbackInbox />
    case 'campaigns':
      return <Campaigns />
    case 'inventory':
      return <Inventory />
    case 'promotions':
      return <Promotions />
    case 'cash-loss':
      return <CashLossView />
    case 'staff-admin':
      return <StaffAdmin />
    case 'roster':
      return <Roster />
    case 'group':
      return <GroupDashboard />
    default:
      return null
  }
}

interface ConsoleAppProps {
  onExit: () => void
}

export function ConsoleApp({ onExit }: ConsoleAppProps) {
  // AuthProvider is hoisted to App.tsx (above OpsProvider) so the ops store can
  // read the signed-in user's restaurantId for Supabase sync; here we just
  // render. The QueryClientProvider powers the Django-backed views (e.g. the
  // live Menu editor) that are migrating off the localStorage ops store.
  return (
    <QueryClientProvider client={queryClient}>
      <ConsoleBody onExit={onExit} />
    </QueryClientProvider>
  )
}

function ConsoleBody({ onExit }: ConsoleAppProps) {
  const auth = useAuth()
  // Demo mode defaults to admin and uses the manual switcher. In supabase mode the
  // role follows the signed-in user's app_users.role (see the effect below).
  const initialRole: Role = auth.mode === 'supabase' && auth.appRole ? auth.appRole : 'admin'
  const [role, setRole] = useState<Role>(initialRole)
  const [activeView, setActiveView] = useState<ConsoleView>(defaultViewFor(initialRole))
  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGES[0])
  const [billingFocusTableId, setBillingFocusTableId] = useState<string | null>(null)

  const navigate = useCallback((v: ConsoleView) => setActiveView(v), [])

  const handleRole = useCallback((r: Role) => {
    setRole(r)
    setActiveView(defaultViewFor(r))
  }, [])

  // Supabase mode only: when the user's app_users.role resolves (or changes),
  // adopt it as the active console role and reset to that role's default view.
  // Guarded so it never interferes with the demo-mode manual switcher.
  useEffect(() => {
    if (auth.mode !== 'supabase' || !auth.appRole) return
    if (auth.appRole === role) return
    handleRole(auth.appRole)
  }, [auth.mode, auth.appRole, role, handleRole])

  const focusBilling = useCallback((tableId: string) => {
    setBillingFocusTableId(tableId)
    setActiveView('waiter-billing')
  }, [])

  // Leaving the console signs out too when real auth is on.
  const handleExit = useCallback(() => {
    if (auth.mode === 'supabase') void auth.signOut()
    onExit()
  }, [auth, onExit])

  const viewCtx = useMemo<ViewContextValue>(
    () => ({ role, dateRange, currentWaiterId: CURRENT_WAITER_ID, navigate, billingFocusTableId, focusBilling }),
    [role, dateRange, billingFocusTableId, navigate, focusBilling],
  )

  // Auth gate (Supabase mode only). Demo mode falls straight through.
  if (auth.mode === 'supabase') {
    if (auth.status === 'loading') {
      return (
        <div className="min-h-screen grid place-items-center" style={{ background: '#FBF7F0', color: '#6E1F2C' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20 }}>Relish…</span>
        </div>
      )
    }
    if (!auth.user) return <SignIn />
  }

  return (
    <ToastProvider>
      <ViewProvider value={viewCtx}>
        <ConsoleShell
          role={role}
          onRole={handleRole}
          showRoleSwitcher={auth.mode === 'demo'}
          activeView={activeView}
          onNavigate={navigate}
          dateRange={dateRange}
          onDateRange={setDateRange}
          onExit={handleExit}
        >
          {/* No AnimatePresence/mode="wait": waiting on the outgoing view's exit
              made fast navbar clicks drop a blank/stale frame. Keying the div on
              activeView remounts + fades in the new view immediately, glitch-free. */}
          <motion.div key={activeView} variants={fadeIn} initial="hidden" animate="visible">
            {renderView(activeView)}
          </motion.div>
        </ConsoleShell>
        <CommandPalette
          onExit={handleExit}
          showRoleSwitcher={auth.mode === 'demo'}
          onRole={handleRole}
          onDateRange={(days) => setDateRange(DATE_RANGES.find(r => r.days === days)!)}
        />
      </ViewProvider>
    </ToastProvider>
  )
}
