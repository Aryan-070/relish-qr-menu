import { useState } from 'react'
import { motion } from 'framer-motion'
import { type Category, type MenuItem } from '../data/menu'
import { MenuCard } from '../components/molecules/MenuCard'
import { LqipVideo } from '../components/atoms/LqipVideo'
import { useMediaMode } from '../theme/MediaModeContext'
import { resolveCategoryVideo } from '../data/videoManifest'
import { BubblesAnim } from '../components/animations/BubblesAnim'
import { SteamAnim } from '../components/animations/SteamAnim'
import { DrizzleAnim } from '../components/animations/DrizzleAnim'
import { SwirlAnim } from '../components/animations/SwirlAnim'
import { PlateAnim } from '../components/animations/PlateAnim'
import { Button } from '../components/atoms/Button'
import { stagger, fadeUp } from '../animations/variants'
import { useTheme } from '../theme/ThemeContext'

interface CategoryPageProps {
  category: Category
  onItemTap: (item: MenuItem) => void
  onRecommend: () => void
}

// Soft per-category tint for the floating-dish hero gradient
const CATEGORY_TINT: Record<string, string> = {
  beverages:  '#E8F2E2',
  soups:      '#FAEEDD',
  quickbites: '#FBEAE0',
  italian:    '#FBEED4',
  desserts:   '#F4EAF4',
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
  const { tokens: t } = useTheme()
  const { posterOnly } = useMediaMode()
  const [bannerErr, setBannerErr] = useState(false)
  const categoryVideo = resolveCategoryVideo(category.id)

  return (
    <div className="flex flex-col paper-bg">
      {/* Hero section */}
      <div
        className="relative px-4 pt-5 pb-4 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}
      >
        {/* Ambient CSS animation — only in image mode; the banner video supplies motion otherwise */}
        {posterOnly && <AnimationForCategory type={category.backgroundAnimation} />}

        <div className="relative w-full max-w-5xl mx-auto" style={{ zIndex: 1 }}>
          {/* Category title with gold underline draw */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="font-bold mb-1"
              style={{
                fontFamily: t.headerFont,
                textTransform: t.headerTransform,
                fontSize: t.headerSize,
                color: t.headerColor,
                lineHeight: 1.08,
                letterSpacing: t.headerSpacing,
              }}
            >
              {category.name}
            </h2>
            {/* Underline — animated gold draw (warm) vs hard rule (hybrid/brutalist) */}
            {t.navStyle === 'pill' ? (
              <svg height="6" width="120" className="mb-2" viewBox="0 0 120 6">
                <line
                  x1="0" y1="3" x2="120" y2="3"
                  stroke="#D9A03A" strokeWidth="2" strokeLinecap="round"
                  style={{ strokeDasharray: 120, strokeDashoffset: 120, animation: 'drizzle-draw 0.7s 0.3s ease-out forwards' }}
                />
              </svg>
            ) : (
              <div className="mb-2" style={{ width: 44, height: 3, background: t.accent }} />
            )}
            <p
              style={{
                fontFamily: t.accentFont,
                fontStyle: t.navStyle === 'pill' ? 'italic' : 'normal',
                fontSize: t.navStyle === 'pill' ? 15 : 13,
                lineHeight: 1.4,
                color: t.inkSoft,
              }}
            >
              {category.editorialNote}
            </p>
          </motion.div>
        </div>

        {/* Category banner photo (blur-up) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-3 relative overflow-hidden w-full max-w-5xl mx-auto"
          style={{
            zIndex: 1,
            borderRadius: t.cardRadius,
            border: t.navStyle === 'underline' ? `1.5px solid ${t.ruleColor}` : `1px solid ${t.accent}22`,
          }}
        >
          {!bannerErr ? (
            <LqipVideo
              key={category.id}
              renditions={categoryVideo.renditions}
              poster={categoryVideo.poster}
              alt={category.name}
              posterOnly={posterOnly}
              play="visible"
              wrapperClassName="w-full aspect-[16/5]"
              videoClassName="w-full h-full object-cover"
              onError={() => setBannerErr(true)}
            />
          ) : (
            <div
              className="w-full aspect-[16/5]"
              style={{ background: `linear-gradient(115deg, ${CATEGORY_TINT[category.id] ?? '#F4EFE6'} 0%, ${t.bg} 75%)` }}
            />
          )}
        </motion.div>
      </div>

      {/* Item list — responsive grid (1 / 2 / 3 columns) */}
      <div className="px-4 py-4 w-full max-w-5xl mx-auto">
        <motion.ul
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none m-0 p-0"
        >
          {category.items.map(item => (
            <motion.li key={item.id} variants={fadeUp}>
              <MenuCard item={item} onTap={onItemTap} />
            </motion.li>
          ))}
        </motion.ul>

        {/* Recommend CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 mb-4 flex flex-col items-center gap-2"
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
