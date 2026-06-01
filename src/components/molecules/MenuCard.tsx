import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { type MenuItem, getCategoryForItem } from '../../data/menu'
import { useTheme } from '../../theme/ThemeContext'
import { CategoryIcon } from '../../lib/categoryIcons'
import { LqipVideo } from '../atoms/LqipVideo'
import { useMediaMode } from '../../theme/MediaModeContext'
import { resolveDishVideo } from '../../data/videoManifest'
import { DietBadge, TagLabel, SpiceLevel, ChefSpecial } from '../atoms/DietaryBadges'

const CATEGORY_BG: Record<string, string> = {
  beverages:  'linear-gradient(135deg,rgba(217,160,58,0.18),rgba(244,208,63,0.28))',
  soups:      'linear-gradient(135deg,rgba(139,16,36,0.10),rgba(217,160,58,0.18))',
  quickbites: 'linear-gradient(135deg,rgba(79,122,60,0.10),rgba(217,160,58,0.15))',
  italian:    'linear-gradient(135deg,rgba(215,25,32,0.08),rgba(217,160,58,0.18))',
  desserts:   'linear-gradient(135deg,rgba(217,160,58,0.18),rgba(139,16,36,0.08))',
}

interface MenuCardProps {
  item: MenuItem
  onTap: (item: MenuItem) => void
}

export function MenuCard({ item, onTap }: MenuCardProps) {
  const { tokens: t } = useTheme()
  const { posterOnly } = useMediaMode()
  const catId = getCategoryForItem(item.id)
  const bg = CATEGORY_BG[catId] ?? CATEGORY_BG.quickbites
  const [imgErr, setImgErr] = useState(false)
  const isRule = t.cardSeparator === 'rule'
  const dishVideo = resolveDishVideo(item)

  const open = () => onTap(item)
  const addTap = (e: React.MouseEvent) => { e.stopPropagation(); onTap(item) }

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      onClick={open}
      className="flex items-stretch gap-3 cursor-pointer"
      style={{
        background: t.cardBg,
        borderRadius: t.cardRadius,
        border: isRule ? 'none' : t.cardBorder,
        borderBottom: isRule ? `1.5px solid ${t.ruleColor}` : t.cardBorder,
        boxShadow: t.cardShadow,
        padding: 12,
        minHeight: 88,
      }}
    >
      {/* Thumbnail — vertically centered, 80px, theme radius */}
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          width: 80,
          height: 80,
          alignSelf: 'center',
          flexShrink: 0,
          borderRadius: t.thumbRadius,
          border: t.thumbBorder,
          background: bg,
        }}
      >
        {!imgErr ? (
          <LqipVideo
            renditions={dishVideo.renditions}
            poster={dishVideo.poster}
            alt={item.name}
            posterOnly={posterOnly}
            play="visible"
            wrapperClassName="w-full h-full"
            videoClassName="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <CategoryIcon categoryId={catId} size={30} color={t.accent} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Title */}
        <h3
          className="truncate"
          style={{
            fontFamily: t.titleFont,
            textTransform: t.titleTransform,
            fontWeight: t.titleWeight,
            fontSize: t.titleSize,
            letterSpacing: t.titleSpacing,
            lineHeight: 1.25,
            color: t.ink,
          }}
        >
          {item.name}
        </h3>

        {/* Description */}
        <p
          style={{
            fontFamily: t.descFont,
            fontSize: isRule ? 11 : 12.5,
            lineHeight: 1.45,
            color: t.descColor,
            marginTop: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description}
        </p>

        {/* Footer row: badges (left) · price + add (right) */}
        <div className="flex items-center justify-between gap-2" style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {item.chefsSpecial && <ChefSpecial theme={t} compact />}
            {item.isJain && <DietBadge label="Jain" theme={t} />}
            {item.canBeJain && !item.isJain && <DietBadge label="Jain-able" theme={t} />}
            <SpiceLevel level={item.spiceLevel} theme={t} />
            {!item.chefsSpecial && item.tags[0] && <TagLabel label={item.tags[0]} theme={t} />}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              style={{
                fontFamily: t.priceFont,
                fontWeight: t.priceWeight,
                fontSize: t.priceSize,
                color: t.priceColor,
              }}
            >
              ₹{item.price}
            </span>
            <AddButton theme={t} onClick={addTap} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Sub-bits (theme-aware) ──────────────────────────────────────────────────
type Tokens = ReturnType<typeof useTheme>['tokens']

function AddButton({ theme: t, onClick }: { theme: Tokens; onClick: (e: React.MouseEvent) => void }) {
  if (t.addShape === 'square') {
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        aria-label="Add to order"
        className="flex items-center gap-1"
        style={{
          fontFamily: t.descFont,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#FFF8EA',
          background: t.accent,
          border: 'none',
          borderRadius: 0,
          padding: '7px 10px',
          minHeight: 32,
          cursor: 'pointer',
        }}
      >
        <Plus size={13} strokeWidth={2.75} />
        ADD
      </motion.button>
    )
  }
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label="Add to order"
      className="flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        borderRadius: 9999,
        background: t.accent,
        border: 'none',
        color: '#FFF8EA',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(139,16,36,0.28)',
      }}
    >
      <Plus size={18} strokeWidth={2.5} />
    </motion.button>
  )
}
