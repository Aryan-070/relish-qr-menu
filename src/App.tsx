import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LandingCover } from './screens/LandingCover'
import { LandingGastronomique } from './screens/LandingGastronomique'
import { LandingEditorial } from './screens/LandingEditorial'
import { LandingBotanica } from './screens/LandingBotanica'
import { MenuBooklet } from './screens/MenuBooklet'
import { RecommendationFlow } from './screens/RecommendationFlow'
import { ItemDetail } from './screens/ItemDetail'
import { AddToOrder } from './screens/AddToOrder'
import { ServicePanel } from './screens/ServicePanel'
import { OrderPanel } from './screens/OrderPanel'
import { useOrder } from './hooks/useOrder'
import { type MenuItem } from './data/menu'
import { fadeIn } from './animations/variants'

type Screen = 'cover' | 'menu' | 'recommend'
type LandingVariant = 'classic' | 'gastronomique' | 'editorial' | 'botanica'

const VARIANTS: Array<{ id: LandingVariant; label: string }> = [
  { id: 'classic',        label: 'Classic'  },
  { id: 'gastronomique',  label: 'Deco'     },
  { id: 'editorial',      label: 'Editorial'},
  { id: 'botanica',       label: 'Botanica' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('cover')
  const [landingVariant, setLandingVariant] = useState<LandingVariant>('classic')

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [addingItem, setAddingItem] = useState<{ item: MenuItem; customization: string } | null>(null)
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)

  const { orderItems, addItem, removeItem, updateQuantity, updateNote, total, count } = useOrder()

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
    <div className="app-shell">
      <AnimatePresence mode="wait">
        {screen === 'cover' && (
          <motion.div
            key="cover"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
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
          </motion.div>
        )}

        {screen === 'menu' && (
          <motion.div
            key="menu"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
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
            exit="exit"
            className="absolute inset-0"
          >
            <RecommendationFlow
              onBack={goBackFromRecommend}
              onOpenMenu={goToMenu}
              onWaiter={openWaiter}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  )
}
