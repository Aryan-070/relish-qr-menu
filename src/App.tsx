import { useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid } from 'lucide-react'
import { LandingSignatureDish } from './screens/LandingSignatureDish'
import { ItemDetail } from './screens/ItemDetail'
import { AddToOrder } from './screens/AddToOrder'
import { ServicePanel } from './screens/ServicePanel'
import { OrderPanel } from './screens/OrderPanel'
import { useOrder } from './hooks/useOrder'
import { type MenuItem } from './data/menu'
import { fadeIn } from './animations/variants'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { MediaModeProvider } from './theme/MediaModeContext'
import { ThemeSwitcher } from './components/molecules/ThemeSwitcher'
import { MediaModeSwitcher } from './components/molecules/MediaModeSwitcher'
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
  const [addingItem, setAddingItem] = useState<{ item: MenuItem; customization: string } | null>(null)
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)

  const { orderItems, addItem, removeItem, updateQuantity, updateNote, total, count } = useOrder()

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

  // All hooks are declared above this point — keep the early return below them
  // so hook order stays stable across guest/staff toggles (Rules of Hooks).
  if (appMode === 'staff') {
    return (
      <div className="app-shell" data-ui-theme={theme}>
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

  const openWaiter = () => setWaiterOpen(true)

  const handleItemTap = (item: MenuItem) => setSelectedItem(item)

  const handleAddToOrder = (item: MenuItem, customization: string) => {
    addItem(item, customization)
    setSelectedItem(null)
    setAddingItem({ item, customization })
  }

  const handleAddConfirmDone = () => setAddingItem(null)

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
        customization={addingItem?.customization}
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
        onWaiter={() => { setOrderOpen(false); setTimeout(openWaiter, 80) }}
      />

      {/* Service panel — replaces WaiterPanel */}
      <ServicePanel
        open={waiterOpen}
        onClose={() => setWaiterOpen(false)}
        onRecommend={() => { setWaiterOpen(false); setTimeout(goToRecommend, 80) }}
        onOpenMenu={() => { setWaiterOpen(false); setTimeout(goToMenu, 80) }}
        onViewOrder={() => { setWaiterOpen(false); setTimeout(() => setOrderOpen(true), 80) }}
        orderCount={count}
        total={total}
      />

      {/* Global UI-theme switcher — collapsed gear, anchored per-screen so it never overlaps nav */}
      <ThemeSwitcher screen={screen} />

      {/* Media-mode switcher — Video/Photo toggle, opposite corner from the theme gear */}
      <MediaModeSwitcher screen={screen} />

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
        <MediaModeProvider>
          <AppInner />
        </MediaModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
