import { useState } from 'react'
import { motion } from 'framer-motion'
import { type Category, type MenuItem } from '../data/menu'
import { MenuCard } from '../components/molecules/MenuCard'
import { CategoryIllustration } from '../components/atoms/CategoryIllustration'
import { BubblesAnim } from '../components/animations/BubblesAnim'
import { SteamAnim } from '../components/animations/SteamAnim'
import { DrizzleAnim } from '../components/animations/DrizzleAnim'
import { SwirlAnim } from '../components/animations/SwirlAnim'
import { PlateAnim } from '../components/animations/PlateAnim'
import { Button } from '../components/atoms/Button'
import { stagger, fadeUp } from '../animations/variants'

interface CategoryPageProps {
  category: Category
  onItemTap: (item: MenuItem) => void
  onRecommend: () => void
}

// Maps category ID to the actual banner filename (note: desserts file is singular)
const BANNER_FILE: Record<string, string> = {
  beverages:  'beverages-banner.webp',
  soups:      'soups-banner.webp',
  quickbites: 'quickbites-banner.webp',
  italian:    'italian-banner.webp',
  desserts:   'dessert-banner.webp',
}

function AnimationForCategory({ type }: { type: Category['backgroundAnimation'] }) {
  if (type === 'bubbles') return <BubblesAnim />
  if (type === 'steam')   return <SteamAnim />
  if (type === 'drizzle') return <DrizzleAnim />
  if (type === 'swirl')   return <SwirlAnim />
  if (type === 'plate')   return <PlateAnim />
  return null
}

export function CategoryPage({ category, onItemTap, onRecommend }: CategoryPageProps) {
  const [bannerErr, setBannerErr] = useState(false)
  const bannerSrc = `/assets/covers/${BANNER_FILE[category.id] ?? `${category.id}-banner.webp`}`

  return (
    <div className="flex flex-col paper-bg min-h-0 flex-1">
      {/* Hero section */}
      <div
        className="relative px-4 pt-5 pb-4 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}
      >
        <AnimationForCategory type={category.backgroundAnimation} />

        <div className="relative" style={{ zIndex: 1 }}>
          {/* Category title with gold underline draw */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="font-playfair font-bold mb-1"
              style={{ fontSize: 26, color: 'var(--maroon)', lineHeight: 1.15 }}
            >
              {category.name}
            </h2>
            {/* Gold underline SVG draw */}
            <svg height="6" width="120" className="mb-2" viewBox="0 0 120 6">
              <line
                x1="0" y1="3" x2="120" y2="3"
                stroke="#D9A03A"
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 120,
                  strokeDashoffset: 120,
                  animation: 'drizzle-draw 0.7s 0.3s ease-out forwards',
                }}
              />
            </svg>
            <p
              className="font-cormorant italic text-[13px]"
              style={{ color: 'var(--ink-soft)' }}
            >
              {category.editorialNote}
            </p>
          </motion.div>
        </div>

        {/* Category banner — real photo with SVG illustration fallback */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-3 relative overflow-hidden rounded-2xl"
          style={{ zIndex: 1 }}
        >
          {!bannerErr ? (
            <img
              key={category.id}
              src={bannerSrc}
              alt={category.name}
              className="w-full aspect-[21/9] object-cover"
              onError={() => setBannerErr(true)}
            />
          ) : (
            <CategoryIllustration
              categoryId={category.id}
              className="aspect-[16/7]"
            />
          )}
        </motion.div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          {category.items.map(item => (
            <motion.div key={item.id} variants={fadeUp}>
              <MenuCard item={item} onTap={onItemTap} />
            </motion.div>
          ))}
        </motion.div>

        {/* Recommend CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 mb-4 flex flex-col items-center gap-2"
        >
          <div className="gold-divider w-full" />
          <p
            className="font-cormorant italic text-[13px]"
            style={{ color: 'var(--ink-soft)' }}
          >
            Not sure what to order?
          </p>
          <Button variant="gold" onClick={onRecommend}>
            ✦ Ask for a Recommendation
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
