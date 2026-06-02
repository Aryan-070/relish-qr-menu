import { useState } from 'react'
import { motion } from 'framer-motion'
import { categories, type MenuItem } from '../data/menu'
import { TopBar } from '../components/molecules/TopBar'
import { CategoryNav } from '../components/molecules/CategoryNav'
import { BottomNav } from '../components/molecules/BottomNav'
import { CategoryPage } from './CategoryPage'
import { slideLeft, slideRight } from '../animations/variants'

interface MenuBookletProps {
  orderCount: number
  onItemTap: (item: MenuItem) => void
  onWaiter: () => void
  onRecommend: () => void
  onViewOrder: () => void
}

export function MenuBooklet({
  orderCount,
  onItemTap,
  onWaiter,
  onRecommend,
  onViewOrder,
}: MenuBookletProps) {
  const [activeCatId, setActiveCatId] = useState(categories[0].id)
  const [direction, setDirection] = useState<'left' | 'right'>('left')

  const handleCategoryChange = (id: string) => {
    const nextIdx = categories.findIndex(c => c.id === id)
    const currIdx = categories.findIndex(c => c.id === activeCatId)
    setDirection(nextIdx > currIdx ? 'left' : 'right')
    setActiveCatId(id)
  }

  const activeCategory = categories.find(c => c.id === activeCatId) ?? categories[0]
  const variants = direction === 'left' ? slideLeft : slideRight

  return (
    <div
      className="flex flex-col h-full paper-bg"
      style={{ overflow: 'hidden' }}
    >
      {/* Sticky top */}
      <div className="flex-shrink-0">
        <TopBar activeCategoryId={activeCatId} onWaiter={onWaiter} />
        <CategoryNav activeId={activeCatId} onChange={handleCategoryChange} />
      </div>

      {/* Page content — keyed motion.div (no AnimatePresence): changing the key
          unmounts the previous category instantly (no stale/blank/accumulation)
          and the new page plays its directional enter animation. */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          key={activeCatId}
          variants={variants}
          initial="hidden"
          animate="visible"
          className="absolute inset-0 overflow-y-auto"
        >
          <CategoryPage
            category={activeCategory}
            onItemTap={onItemTap}
            onRecommend={onRecommend}
          />
        </motion.div>
      </div>

      {/* Sticky bottom nav */}
      <div className="flex-shrink-0">
        <BottomNav
          orderCount={orderCount}
          onAskAI={onRecommend}
          onWaiter={onWaiter}
          onViewOrder={onViewOrder}
        />
      </div>
    </div>
  )
}
