import { motion } from 'framer-motion'
import { type MenuItem } from '../../data/menu'
import { useTheme } from '../../theme/ThemeContext'
import { useComponentStyle } from '../../theme/ComponentStyleContext'
import { useMediaMode } from '../../theme/MediaModeContext'
import { resolveDishVideo } from '../../data/videoManifest'
import { LqipVideo } from '../atoms/LqipVideo'
import { TiltCard } from '../fx/TiltCard'
import { formatMoney } from '../../lib/money'
import { useT } from '../../i18n'

interface FeaturedBentoProps {
  items: MenuItem[]
  onTap: (item: MenuItem) => void
}

/**
 * Asymmetric "Chef's Picks" bento that opens each category — one wide hero tile
 * plus two square tiles. Theme-aware: soft & rounded in warm/editorial, hard-edged
 * in hybrid/brutalist (radius/border/fonts all come from tokens). Skipped when the
 * category has fewer than three items.
 */
export function FeaturedBento({ items, onTap }: FeaturedBentoProps) {
  const { tokens: t } = useTheme()
  const { style: engine } = useComponentStyle()
  const { posterOnly } = useMediaMode()
  const tr = useT()

  // Chef's specials first, then fill to three with the next items.
  const featured = [...items]
    .sort((a, b) => Number(Boolean(b.chefsSpecial)) - Number(Boolean(a.chefsSpecial)))
    .slice(0, 3)
  if (featured.length < 3) return null

  const isHard = t.navStyle === 'underline'
  const radius = isHard ? 0 : Math.max(t.cardRadius, 16)
  const border = isHard ? `1.5px solid ${t.ruleColor}` : t.cardBorder

  return (
    <div className="mb-5 max-w-5xl mx-auto">
      <div
        className="mb-2.5"
        style={{
          fontFamily: t.pill.font,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontSize: 10,
          color: t.accent,
        }}
      >
        {tr('reco.chefsPicks')}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {featured.map((item, i) => (
          <Tile
            key={item.id}
            item={item}
            onTap={onTap}
            posterOnly={posterOnly}
            hero={i === 0}
            radius={radius}
            border={border}
            accent={t.accent}
            titleFont={t.titleFont}
            priceFont={t.priceFont}
            sharp={isHard}
            spectacle={engine === 'spectacle' && !isHard}
          />
        ))}
      </div>
    </div>
  )
}

interface TileProps {
  item: MenuItem
  onTap: (item: MenuItem) => void
  posterOnly: boolean
  hero: boolean
  radius: number
  border: string
  accent: string
  titleFont: string
  priceFont: string
  sharp: boolean
  spectacle: boolean
}

function Tile({ item, onTap, posterOnly, hero, radius, border, accent, titleFont, priceFont, sharp, spectacle }: TileProps) {
  const dishVideo = resolveDishVideo(item)
  const tile = (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={spectacle ? undefined : { scale: 1.012 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={() => onTap(item)}
      className={`relative cursor-pointer overflow-hidden ${hero ? 'col-span-2' : ''}`}
      style={{ borderRadius: radius, border }}
    >
      <LqipVideo
        renditions={dishVideo.renditions}
        poster={dishVideo.poster}
        alt={item.name}
        posterOnly={posterOnly}
        play="visible"
        wrapperClassName={hero ? 'w-full aspect-[16/9]' : 'w-full aspect-square'}
        videoClassName="w-full h-full object-cover"
      />
      {/* Bottom scrim for legible overlaid label */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0"
        style={{ height: '62%', background: 'linear-gradient(to top, rgba(20,16,12,0.78), transparent)' }}
      />
      <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end justify-between gap-2">
        <span
          className="leading-tight"
          style={{
            fontFamily: titleFont,
            fontWeight: 600,
            fontSize: hero ? 16 : 12.5,
            color: '#FFF8EA',
            textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          }}
        >
          {item.name}
        </span>
        <span
          className="shrink-0 px-2 py-0.5"
          style={{
            fontFamily: priceFont,
            fontWeight: 600,
            fontSize: hero ? 12.5 : 11,
            color: '#FFF8EA',
            background: accent,
            borderRadius: sharp ? 0 : 9999,
          }}
        >
          {formatMoney(item.price)}
        </span>
      </div>
    </motion.div>
  )
  return spectacle ? <TiltCard max={hero ? 5 : 7} className={hero ? 'col-span-2' : ''}>{tile}</TiltCard> : tile
}
