import { useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid } from 'lucide-react'
import { LandingSignatureDish } from './screens/LandingSignatureDish'
import { ItemDetail } from './screens/ItemDetail'
import { AddToOrder } from './screens/AddToOrder'
import { ServicePanel } from './screens/ServicePanel'
import { OrderPanel } from './screens/OrderPanel'
import { Checkout } from './screens/Checkout'
import { useOrder } from './hooks/useOrder'
import { type MenuItem, getCategoryForItem } from './data/menu'
import { type SelectedModifier, selectionLabel, selectionUnitPrice } from './data/modifiers'
import { type Combo } from './data/combos'
import { type OrderRecord, type OrderLine } from './console/lib/types'
import { resolveGuestTableId } from './lib/tableSession'
import { fadeIn } from './animations/variants'

// The table this guest is seated at — read from the scanned QR's `?t=` param,
// falling back to a fixed demo table. Resolved once at load (a scan is a full
// page navigation), see src/lib/tableSession.ts.
const GUEST_TABLE_ID = resolveGuestTableId()
import { ThemeProvider, useTheme } from './theme/ThemeContext'
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

// Kiosk mode: a full-screen self-order station, activated by `?kiosk=1` in the
// URL (read once at load — a kiosk is provisioned via its own URL).
const KIOSK_MODE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kiosk') === '1'

type Screen = 'cover' | 'menu' | 'recommend'
type LandingVariant = 'classic' | 'gastronomique' | 'editorial' | 'botanica' | 'signature' | 'cinematic' | 'reel'

const VARIANTS: Array<{ id: LandingVariant; label: string }> = [
  { id: 'signature',      label: 'Signature'},
  { id: 'classic',        label: 'Classic'  },
  { id: 'gastronomique',  label: 'Deco'     },
  { id: 'editorial',      label: 'Editorial'},
  { id: 'botanica',       label: 'Botanica' },
  { id: 'cinematic',      label: 'Cinema'   },
  { id: 'reel',           label: 'Reel'     },
]

function AppInner() {
  const { theme } = useTheme()
  const [appMode, setAppMode] = useState<'guest' | 'staff'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#staff' ? 'staff' : 'guest',
  )
  const [screen, setScreen] = useState<Screen>('cover')
  const [landingVariant, setLandingVariant] = useState<LandingVariant>('reel')

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [addingItem, setAddingItem] = useState<{ item: MenuItem; label: string; unitPrice: number } | null>(null)
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  // When the panel opens because the guest just paid, land it on feedback.
  const [serviceInitialView, setServiceInitialView] = useState<'feedback' | undefined>(undefined)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null)
  // Transient status the Dynamic Island flashes (placed/waiter) before settling
  // back to its derived cart/idle state.
  const [islandFlash, setIslandFlash] = useState<'placed' | 'waiter' | null>(null)
  const flashIsland = (m: 'placed' | 'waiter') => {
    setIslandFlash(m)
    window.setTimeout(() => setIslandFlash(null), 4000)
  }

  const { orderItems, addItem, addCombo, removeItem, updateQuantity, updateNote, clear, total, count } = useOrder()
  const ops = useOpsStore()

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

  // All hooks are declared above this point — keep the early returns below them
  // so hook order stays stable across guest/staff/kiosk toggles (Rules of Hooks).
  if (KIOSK_MODE) {
    return (
      <div className="app-shell" data-ui-theme={theme}>
        <Suspense fallback={null}>
          <Kiosk />
        </Suspense>
      </div>
    )
  }

  if (appMode === 'staff') {
    return (
      <div className="app-shell console-shell" data-ui-theme={theme}>
        <Suspense fallback={null}>
          <ConsoleApp onExit={exitStaff} />
        </Suspense>
      </div>
    )
  }

  const goToMenu = () => setScreen('menu')

  // Always go to menu (not cover) from recommend — cleaner UX
  const goBackFromRecommend = () => setScreen('menu')

  const goToRecommend = () => setScreen('recommend')

  const openWaiter = () => { setServiceInitialView(undefined); setWaiterOpen(true); flashIsland('waiter') }

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

  // Commit the guest cart to the shared ops store so it surfaces on the
  // waiter floor and the kitchen display, then reset the cart.
  const handlePlaceOrder = () => {
    if (orderItems.length === 0) return
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
    // Accrue loyalty points for a linked member (1 point per ₹10 spent).
    if (activeCustomerId) ops.adjustPoints(activeCustomerId, Math.floor(total / 10))
    // Cart is cleared when the panel closes (see OrderPanel onWaiter), so the
    // "Calling waiter…" confirmation animation still has items to show.
  }

  // Open the pay-at-table checkout for the current cart/bill.
  const handleOpenCheckout = () => {
    if (orderItems.length === 0) return
    setOrderOpen(false)
    setTimeout(() => setCheckoutOpen(true), 80)
  }

  // Payment succeeded: mark the table's orders paid, clear the cart, then route
  // the guest into the post-pay feedback flow (the Sunday review pattern).
  const handlePaid = () => {
    ops.payTables([GUEST_TABLE_ID])
    clear()
    setCheckoutOpen(false)
    setServiceInitialView('feedback')
    setTimeout(() => setWaiterOpen(true), 120)
  }

  return (
    <div className="app-shell" data-ui-theme={theme}>
      <Suspense fallback={null}>
        {screen === 'cover' && (
          <motion.div
            key="cover"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="absolute inset-0"
          >
            {landingVariant === 'classic' && (
              <LandingCover onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'gastronomique' && (
              <LandingGastronomique onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'editorial' && (
              <LandingEditorial onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'botanica' && (
              <LandingBotanica onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'signature' && (
              <LandingSignatureDish onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'cinematic' && (
              <LandingCinematic onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
            {landingVariant === 'reel' && (
              <LandingReel onOpenMenu={goToMenu} onRecommend={goToRecommend} onWaiter={openWaiter} />
            )}
          </motion.div>
        )}

        {screen === 'menu' && (
          <motion.div
            key="menu"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="absolute inset-0"
          >
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
          <motion.div
            key="recommend"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="absolute inset-0"
          >
            <RecommendationFlow
              onBack={goBackFromRecommend}
              onOpenMenu={goToMenu}
              onWaiter={openWaiter}
              onAddCombo={handleAddCombo}
            />
          </motion.div>
        )}
      </Suspense>

      {/* Variant switcher — only on cover screen */}
      {screen === 'cover' && (
        <div className="absolute top-3 right-3 z-50 flex flex-col gap-1">
          {VARIANTS.map((v, i) => (
            <motion.button
              key={v.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setLandingVariant(v.id)}
              className="px-2.5 py-1 rounded-full font-inter text-[8.5px] uppercase tracking-widest text-right"
              style={{
                background: landingVariant === v.id
                  ? 'rgba(217,160,58,0.28)'
                  : 'rgba(0,0,0,0.42)',
                border: landingVariant === v.id
                  ? '1px solid rgba(217,160,58,0.55)'
                  : '1px solid rgba(255,255,255,0.08)',
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

      {/* Item detail — rendered outside AnimatePresence so it survives screen switches */}
      <ItemDetail
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAddToOrder={handleAddToOrder}
        onWaiter={() => { setSelectedItem(null); setTimeout(openWaiter, 80) }}
      />

      {/* Add to order confirmation slip */}
      <AddToOrder
        item={addingItem?.item ?? null}
        label={addingItem?.label}
        unitPrice={addingItem?.unitPrice}
        onContinue={handleAddConfirmDone}
        onShowWaiter={() => { handleAddConfirmDone(); setWaiterOpen(true) }}
      />

      {/* Order panel */}
      <OrderPanel
        open={orderOpen}
        items={orderItems}
        total={total}
        onClose={() => setOrderOpen(false)}
        onRemove={removeItem}
        onUpdateQty={updateQuantity}
        onUpdateNote={updateNote}
        onPlaceOrder={handlePlaceOrder}
        onCheckout={handleOpenCheckout}
        onWaiter={() => { setOrderOpen(false); clear(); setTimeout(openWaiter, 80) }}
      />

      {/* Pay-at-table checkout — settle the bill from the guest's phone */}
      <Checkout
        open={checkoutOpen}
        items={orderItems}
        subtotal={total}
        reference={lastOrderId ?? `ORD-${GUEST_TABLE_ID}`}
        onClose={() => setCheckoutOpen(false)}
        onPaid={handlePaid}
        onAddUpsell={(item) => addItem(item)}
      />

      {/* Service panel — replaces WaiterPanel */}
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

      {/* Dynamic Island — live order/waiter status; appears only when there's
          something to surface (cart items or a transient placed/waiter flash). */}
      {(screen === 'menu' || screen === 'recommend') && (count > 0 || islandFlash) && (
        <DynamicOrderIsland
          mode={(islandFlash ?? 'cart') as IslandMode}
          count={count}
          total={total}
          onView={() => setOrderOpen(true)}
        />
      )}

      {/* Global UI-theme switcher — collapsed gear, anchored per-screen so it never overlaps nav */}
      <ThemeSwitcher screen={screen} />

      {/* Media-mode switcher — Video/Photo toggle, opposite corner from the theme gear */}
      <MediaModeSwitcher screen={screen} />

      {/* Language switcher — bottom-left utility cluster, above the staff entry */}
      <div className="fixed bottom-14 left-3 z-50">
        <LanguageSwitcher />
      </div>

      {/* Discreet staff-console entry — bottom-left, all guest screens */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={enterStaff}
        aria-label="Open staff console"
        title="Staff console"
        className="fixed bottom-3 left-3 z-50 w-9 h-9 inline-flex items-center justify-center rounded-full"
        style={{
          background: 'rgba(42,30,30,0.42)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,248,234,0.78)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <LayoutGrid size={16} />
      </motion.button>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ComponentStyleProvider>
          <MediaModeProvider>
          <LanguageProvider>
            <AuthProvider>
                <OpsProvider>
                  <AppInner />
                </OpsProvider>
              </AuthProvider>
            </LanguageProvider>
          </MediaModeProvider>
        </ComponentStyleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
