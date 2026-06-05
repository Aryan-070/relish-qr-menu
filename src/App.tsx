import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid, Smartphone } from 'lucide-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { LandingSignatureDish } from './screens/LandingSignatureDish'
import { ItemDetail } from './screens/ItemDetail'
import { AddToOrder } from './screens/AddToOrder'
import { ServicePanel } from './screens/ServicePanel'
import { OrderPanel } from './screens/OrderPanel'
import { Checkout } from './screens/Checkout'
import { useOrder } from './hooks/useOrder'
import { type MenuItem } from './data/menu'
import { useMenuData, MenuDataProvider } from './data/MenuDataContext'
import { type SelectedModifier, selectionLabel, selectionUnitPrice } from './data/modifiers'
import { type Combo } from './data/combos'
import { type OrderRecord, type OrderLine } from './console/lib/types'
import { resolveGuestTableId } from './lib/tableSession'
import { fadeIn } from './animations/variants'
import { VARIANTS, DEFAULT_LANDING_VARIANT, type LandingVariant } from './data/landingVariants'
import { queryClient } from './lib/queryClient'
import { useConsumerMenu } from './hooks/useConsumerMenu'
import { useApplyThemeConfig } from './theme/useThemeConfig'
import { useSession } from './hooks/useSession'
import { ApiError } from './lib/api/client'
import type { OrderLineInput } from './lib/api/dining'

/** Raw `?t=` table id from the URL (a real table UUID from the QR), or null. */
function tableParamFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const t = new URLSearchParams(window.location.search).get('t')
  return t && t.length > 0 ? t : null
}

// The table this guest is seated at — read from the scanned QR's `?t=` param,
// falling back to a fixed demo table. Resolved once at load (a scan is a full
// page navigation), see src/lib/tableSession.ts.
const GUEST_TABLE_ID = resolveGuestTableId()
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { BrandProvider } from './theme/BrandContext'
import { AppearanceLoader } from './theme/AppearanceLoader'
import { ComponentStyleProvider } from './theme/ComponentStyleContext'
import { MediaModeProvider } from './theme/MediaModeContext'
import { OpsProvider, useOpsStore } from './console/store/useOpsStore'
import { AuthProvider } from './console/auth/AuthContext'
import { LanguageProvider, LanguageSwitcher } from './i18n'
import { ThemeSwitcher } from './components/molecules/ThemeSwitcher'
import { MediaModeSwitcher } from './components/molecules/MediaModeSwitcher'
import { DynamicOrderIsland, type IslandMode } from './components/DynamicOrderIsland'
import { ErrorBoundary } from './components/ErrorBoundary'

// Code-split: non-default landings + secondary screens load on demand
const LandingCover = lazy(() => import('./screens/LandingCover').then(m => ({ default: m.LandingCover })))
const LandingGastronomique = lazy(() => import('./screens/LandingGastronomique').then(m => ({ default: m.LandingGastronomique })))
const LandingEditorial = lazy(() => import('./screens/LandingEditorial').then(m => ({ default: m.LandingEditorial })))
const LandingBotanica = lazy(() => import('./screens/LandingBotanica').then(m => ({ default: m.LandingBotanica })))
const LandingCinematic = lazy(() => import('./screens/LandingCinematic').then(m => ({ default: m.LandingCinematic })))
const LandingReel = lazy(() => import('./screens/LandingReel').then(m => ({ default: m.LandingReel })))
const MenuBooklet = lazy(() => import('./screens/MenuBooklet').then(m => ({ default: m.MenuBooklet })))
const RecommendationFlow = lazy(() => import('./screens/RecommendationFlow').then(m => ({ default: m.RecommendationFlow })))
const ConsoleApp = lazy(() => import('./console/ConsoleApp').then(m => ({ default: m.ConsoleApp })))
const Kiosk = lazy(() => import('./screens/Kiosk').then(m => ({ default: m.Kiosk })))
const QsrApp = lazy(() => import('./screens/qsr/QsrApp').then(m => ({ default: m.QsrApp })))

// Kiosk mode: a full-screen self-order station, activated by `?kiosk=1` in the
// URL (read once at load — a kiosk is provisioned via its own URL).
const KIOSK_MODE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kiosk') === '1'

// QSR prototype: the Waiter Copilot + Customer Quick Menu pitch, served at the
// dedicated `/qsr` path (read once at load). See src/screens/qsr/.
const QSR_MODE =
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/qsr'

// Demo showcase: the full landing-variant playground + demo data, served at
// `/demo`. The root URL (`/`) instead serves the live backend menu.
const DEMO_MODE =
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/demo'

// Which restaurant the root storefront serves. A `?r=` param overrides the env
// default so a single deploy can preview any tenant.
function resolveRestaurantId(): string | null {
  if (typeof window === 'undefined') return null
  const fromQuery = new URLSearchParams(window.location.search).get('r')
  if (fromQuery) return fromQuery
  const env = import.meta.env.VITE_DEFAULT_RESTAURANT_ID as string | undefined
  return env && env.length > 0 ? env : null
}

type Screen = 'cover' | 'menu' | 'recommend'

interface GuestExperienceProps {
  /** Demo route: switchable landing variants + demo entry buttons + static menu. */
  demo: boolean
  /** Root storefront only: the restaurant whose live menu/theme to load. */
  restaurantId: string | null
  onEnterStaff: () => void
}

function GuestExperience({ demo, restaurantId, onEnterStaff }: GuestExperienceProps) {
  const { theme } = useTheme()
  const applyTheme = useApplyThemeConfig()
  const ops = useOpsStore()

  // Root storefront pulls the live menu + theme from the backend; the demo route
  // uses the bundled static menu (the MenuDataProvider falls back to static).
  const consumer = useConsumerMenu(demo ? null : restaurantId)

  // Real ordering runs through the backend dining session — but only on the root
  // storefront with a real table QR (`?t=`). Demo stays fully offline; the root
  // without a table is browse-only (menu visible, ordering disabled).
  const tableId = tableParamFromUrl()
  const sessionParams = !demo && restaurantId && tableId ? { restaurantId, tableId } : null
  const dining = useSession(sessionParams)
  const orderingMode: 'demo' | 'session' | 'browse' = demo
    ? 'demo'
    : sessionParams
      ? 'session'
      : 'browse'
  const [orderError, setOrderError] = useState<string | null>(null)

  const [screen, setScreen] = useState<Screen>('cover')
  const [landingVariant, setLandingVariant] = useState<LandingVariant>(DEFAULT_LANDING_VARIANT)

  // Apply the published theme/branding (landing variant, colors, fonts, logo)
  // once per distinct config — guarded by a content key so an unstable effect
  // dependency can never drive a render loop.
  const appliedThemeKey = useRef<string | null>(null)
  useEffect(() => {
    if (demo || !consumer.theme) return
    const key = JSON.stringify(consumer.theme)
    if (appliedThemeKey.current === key) return
    appliedThemeKey.current = key
    applyTheme(consumer.theme)
    if (consumer.theme.landing_variant) {
      setLandingVariant(consumer.theme.landing_variant as LandingVariant)
    }
  }, [demo, consumer.theme, applyTheme])

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [addingItem, setAddingItem] = useState<{ item: MenuItem; label: string; unitPrice: number } | null>(null)
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [serviceInitialView, setServiceInitialView] = useState<'feedback' | undefined>(undefined)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null)
  const [islandFlash, setIslandFlash] = useState<'placed' | 'waiter' | null>(null)
  const flashIsland = (m: 'placed' | 'waiter') => {
    setIslandFlash(m)
    window.setTimeout(() => setIslandFlash(null), 4000)
  }

  const { orderItems, addItem, addCombo, removeItem, updateQuantity, updateNote, clear, total, count } = useOrder()
  const { getCategoryForItem } = useMenuData()

  const goToMenu = () => setScreen('menu')
  const goBackFromRecommend = () => setScreen('menu')
  const goToRecommend = () => setScreen('recommend')
  const openWaiter = () => {
    setServiceInitialView(undefined)
    setWaiterOpen(true)
    flashIsland('waiter')
    // On the real storefront this actually notifies staff (a backend service
    // request that lands on the Service Queue / KDS). Demo stays local-only.
    if (orderingMode === 'session') {
      void dining.requestService('waiter').catch(() => {/* best-effort; UI already flashed */})
    }
  }
  const handleItemTap = (item: MenuItem) => setSelectedItem(item)

  const handleAddToOrder = (item: MenuItem, modifiers: SelectedModifier[]) => {
    addItem(item, modifiers)
    setSelectedItem(null)
    setAddingItem({
      item,
      label: selectionLabel(modifiers),
      unitPrice: selectionUnitPrice(item.price, modifiers),
    })
  }

  const handleAddCombo = (combo: Combo) => {
    addCombo(combo)
    setAddingItem({
      item: {
        id: `combo:${combo.id}`,
        name: combo.name,
        price: combo.comboPrice,
        description: '',
        isJain: false,
        canBeJain: false,
        tags: [],
        pairings: {},
        customizations: [],
      },
      label: combo.itemNames.join(' · '),
      unitPrice: combo.comboPrice,
    })
  }

  const handleAddConfirmDone = () => setAddingItem(null)

  const handlePlaceOrder = async () => {
    if (orderItems.length === 0) return
    setOrderError(null)

    // Root + real table QR → submit through the backend dining session. The
    // server enforces the table's ordering policy (leader-only by default) and
    // recomputes all money; on success we clear only the now-submitted cart.
    if (orderingMode === 'session') {
      const lines: OrderLineInput[] = orderItems.map(o => ({
        menu_item_id: o.item.id,
        qty: o.quantity,
        note: [o.label, o.note].filter(Boolean).join(' · ') || undefined,
      }))
      try {
        await dining.submitOrder(lines)
        clear()
        flashIsland('placed')
      } catch (e) {
        setOrderError(
          e instanceof ApiError && e.status === 403
            ? "Your server hasn't enabled ordering for this table yet — please ask them."
            : e instanceof ApiError
              ? (e.body?.detail ?? 'Could not place the order.')
              : 'Could not place the order — please try again.',
        )
      }
      return
    }

    // Root with no table QR — nothing to order against.
    if (orderingMode === 'browse') {
      setOrderError('Scan the QR at your table to place an order.')
      return
    }

    // Demo route: the offline localStorage ops-store path (unchanged).
    const lines: OrderLine[] = orderItems.map(o => ({
      itemId: o.item.id,
      name: o.item.name,
      price: o.unitPrice,
      qty: o.quantity,
      categoryId: getCategoryForItem(o.item.id) || 'combo',
      modifiers: o.label || undefined,
      note: o.note,
    }))
    const seatedTable = ops.state.tables.find(t => t.id === GUEST_TABLE_ID)
    const orderId = `ORD-${String(Date.now()).slice(-6)}`
    setLastOrderId(orderId)
    const order: OrderRecord = {
      id: orderId,
      tableId: GUEST_TABLE_ID,
      waiterId: seatedTable?.waiterId ?? '',
      placedAt: Date.now(),
      lines,
      total,
      paid: false,
      status: 'new',
      source: 'guest',
    }
    ops.placeOrder(order)
    flashIsland('placed')
    if (activeCustomerId) ops.adjustPoints(activeCustomerId, Math.floor(total / 10))
  }

  // Whether the Place Order CTA is enabled, plus the contextual message shown
  // when it isn't (browse-only, or leader-only and this device isn't allowed).
  const canPlaceOrder =
    orderingMode === 'demo' || (orderingMode === 'session' && dining.canOrder)
  const orderGateMessage: string | null =
    orderingMode === 'browse'
      ? 'Scan the QR at your table to order.'
      : orderingMode === 'session' && !dining.canOrder
        ? dining.joining
          ? 'Connecting to your table…'
          : "Your server hasn't started ordering for this table yet — please ask them."
        : null
  const placedOrders = orderingMode === 'session' ? dining.session?.orders ?? [] : []

  const handleOpenCheckout = () => {
    if (orderItems.length === 0) return
    setOrderOpen(false)
    setTimeout(() => setCheckoutOpen(true), 80)
  }

  const handlePaid = () => {
    ops.payTables([GUEST_TABLE_ID])
    clear()
    setCheckoutOpen(false)
    setServiceInitialView('feedback')
    setTimeout(() => setWaiterOpen(true), 120)
  }

  // Root: render the live backend menu; demo: the bundled static menu. The
  // MenuDataProvider lets the same components render either source unchanged.
  const menuCategories = !demo && consumer.categories.length > 0 ? consumer.categories : undefined

  const body = (
    <div className="app-shell" data-ui-theme={theme}>
      <Suspense fallback={null}>
        {screen === 'cover' && (
          <motion.div key="cover" variants={fadeIn} initial="hidden" animate="visible" className="absolute inset-0">
            {landingVariant === 'classic' && <LandingCover onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'gastronomique' && <LandingGastronomique onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'editorial' && <LandingEditorial onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'botanica' && <LandingBotanica onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'signature' && <LandingSignatureDish onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'cinematic' && <LandingCinematic onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
            {landingVariant === 'reel' && <LandingReel onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />}
          </motion.div>
        )}

        {screen === 'menu' && (
          <motion.div key="menu" variants={fadeIn} initial="hidden" animate="visible" className="absolute inset-0">
            <MenuBooklet
              orderCount={count}
              onItemTap={handleItemTap}
              onWaiter={openWaiter}
              onRecommend={goToRecommend}
              onViewOrder={() => setOrderOpen(true)}
            />
          </motion.div>
        )}

        {screen === 'recommend' && (
          <motion.div key="recommend" variants={fadeIn} initial="hidden" animate="visible" className="absolute inset-0">
            <RecommendationFlow onBack={goBackFromRecommend} onOpenMenu={goToMenu} onWaiter={openWaiter} onAddCombo={handleAddCombo} />
          </motion.div>
        )}
      </Suspense>

      {/* Variant switcher — demo route only, cover screen only */}
      {demo && screen === 'cover' && (
        <div className="absolute top-3 right-3 z-50 flex flex-col gap-1">
          {VARIANTS.map((v, i) => (
            <motion.button
              key={v.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setLandingVariant(v.id)}
              className="px-2.5 py-1 rounded-full font-inter text-[8.5px] uppercase tracking-widest text-right"
              style={{
                background: landingVariant === v.id ? 'rgba(217,160,58,0.28)' : 'rgba(0,0,0,0.42)',
                border: landingVariant === v.id ? '1px solid rgba(217,160,58,0.55)' : '1px solid rgba(255,255,255,0.08)',
                color: landingVariant === v.id ? '#D9A03A' : 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              {String(i + 1)} {v.label}
            </motion.button>
          ))}
        </div>
      )}

      <ItemDetail
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToOrder={handleAddToOrder}
        onWaiter={() => { setSelectedItem(null); setTimeout(openWaiter, 80) }}
      />

      <AddToOrder
        item={addingItem?.item ?? null}
        label={addingItem?.label}
        unitPrice={addingItem?.unitPrice}
        onContinue={handleAddConfirmDone}
        onShowWaiter={() => { handleAddConfirmDone(); setWaiterOpen(true) }}
      />

      <OrderPanel
        open={orderOpen}
        items={orderItems}
        total={total}
        placedOrders={placedOrders}
        canPlaceOrder={canPlaceOrder}
        gateMessage={orderGateMessage}
        errorMessage={orderError}
        onClose={() => setOrderOpen(false)}
        onRemove={removeItem}
        onUpdateQty={updateQuantity}
        onUpdateNote={updateNote}
        onPlaceOrder={handlePlaceOrder}
        onCheckout={handleOpenCheckout}
      />

      <Checkout
        open={checkoutOpen}
        items={orderItems}
        subtotal={total}
        reference={lastOrderId ?? `ORD-${GUEST_TABLE_ID}`}
        onClose={() => setCheckoutOpen(false)}
        onPaid={handlePaid}
        onAddUpsell={(item) => addItem(item)}
      />

      <ServicePanel
        open={waiterOpen}
        initialView={serviceInitialView}
        onClose={() => { setWaiterOpen(false); setServiceInitialView(undefined) }}
        onRecommend={() => { setWaiterOpen(false); setTimeout(goToRecommend, 80) }}
        onOpenMenu={() => { setWaiterOpen(false); setTimeout(goToMenu, 80) }}
        onViewOrder={() => { setWaiterOpen(false); setTimeout(() => setOrderOpen(true), 80) }}
        orderCount={count}
        total={total}
        activeCustomerId={activeCustomerId}
        onLinkCustomer={setActiveCustomerId}
      />

      {(screen === 'menu' || screen === 'recommend') && (count > 0 || islandFlash) && (
        <DynamicOrderIsland mode={(islandFlash ?? 'cart') as IslandMode} count={count} total={total} onView={() => setOrderOpen(true)} />
      )}

      <ThemeSwitcher screen={screen} />
      <MediaModeSwitcher screen={screen} />

      <div className="fixed bottom-14 left-3 z-50">
        <LanguageSwitcher />
      </div>

      {/* Demo-only entry affordances (staff console + QSR prototype). The root
          storefront stays clean; staff reach the console via the `#staff` hash. */}
      {demo && (
        <>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onEnterStaff}
            aria-label="Open staff console"
            title="Staff console"
            className="fixed bottom-3 left-3 z-50 w-9 h-9 inline-flex items-center justify-center rounded-full"
            style={{ background: 'rgba(42,30,30,0.42)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,248,234,0.78)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          >
            <LayoutGrid size={16} />
          </motion.button>

          <motion.a
            whileTap={{ scale: 0.9 }}
            href="/qsr"
            aria-label="Open QSR Copilot prototype"
            title="QSR Copilot"
            className="fixed bottom-3 left-14 z-50 w-9 h-9 inline-flex items-center justify-center rounded-full"
            style={{ background: 'rgba(42,30,30,0.42)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,248,234,0.78)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          >
            <Smartphone size={16} />
          </motion.a>
        </>
      )}
    </div>
  )

  // The root storefront wraps the tree with backend-sourced menu data; the demo
  // route renders against the bundled static menu (provider falls back to it).
  return menuCategories ? <MenuDataProvider categories={menuCategories}>{body}</MenuDataProvider> : body
}

function AppInner() {
  const { theme } = useTheme()
  const [appMode, setAppMode] = useState<'guest' | 'staff'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#staff' ? 'staff' : 'guest',
  )

  const enterStaff = () => {
    setAppMode('staff')
    if (typeof window !== 'undefined') window.location.hash = 'staff'
  }
  const exitStaff = () => {
    setAppMode('guest')
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  if (QSR_MODE) {
    return (
      <ThemeProvider forced="table-theory">
        <div className="app-shell" data-ui-theme="table-theory">
          <Suspense fallback={null}>
            <QsrApp />
          </Suspense>
        </div>
      </ThemeProvider>
    )
  }

  if (KIOSK_MODE) {
    return (
      <div className="app-shell" data-ui-theme={theme}>
        <Suspense fallback={null}>
          <Kiosk />
        </Suspense>
      </div>
    )
  }

  // `#staff` is reachable from any URL; the console is always login-gated.
  if (appMode === 'staff') {
    return (
      <div className="app-shell console-shell" data-ui-theme={theme}>
        <Suspense fallback={null}>
          <ConsoleApp onExit={exitStaff} />
        </Suspense>
      </div>
    )
  }

  return (
    <GuestExperience
      demo={DEMO_MODE}
      restaurantId={DEMO_MODE ? null : resolveRestaurantId()}
      onEnterStaff={enterStaff}
    />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrandProvider>
            <ComponentStyleProvider>
              <MediaModeProvider>
                <LanguageProvider>
                  <AuthProvider>
                    <AppearanceLoader />
                    <OpsProvider>
                      <AppInner />
                    </OpsProvider>
                  </AuthProvider>
                </LanguageProvider>
              </MediaModeProvider>
            </ComponentStyleProvider>
          </BrandProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
