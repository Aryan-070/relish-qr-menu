import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'
import { LqipVideo } from '../components/atoms/LqipVideo'
import { useMediaMode } from '../theme/MediaModeContext'
import { videoRenditions } from '../data/videoManifest'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

// The reel cycles through distinct curated clips — each with its own poster + label.
const REEL = [
  { key: 'hero',       poster: '/assets/dishes/ita-004-hero.webp', label: 'Tonight at Relish' },
  { key: 'italian',    poster: '/assets/dishes/ita-001-hero.webp', label: 'Italian Fiesta' },
  { key: 'desserts',   poster: '/assets/dishes/des-002-hero.webp', label: 'Desserts' },
  { key: 'beverages',  poster: '/assets/dishes/bev-005-hero.webp', label: 'Beverages' },
  { key: 'soups',      poster: '/assets/dishes/soup-001-hero.webp', label: 'Soups' },
  { key: 'quickbites', poster: '/assets/dishes/qb-004-hero.webp',  label: 'Quick Bites' },
] as const

type Variant = 'primary' | 'gold' | 'ghost'

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #7A0E1E 0%, #A52030 45%, #8B1024 100%)',
    color: '#FFF8EA',
    border: 'none',
    boxShadow: '0 6px 28px rgba(139,16,36,0.52)',
  },
  gold: {
    background: 'linear-gradient(135deg, rgba(217,160,58,0.18) 0%, rgba(200,140,30,0.10) 100%)',
    color: '#D9A03A',
    border: '1.5px solid rgba(217,160,58,0.6)',
  },
  ghost: {
    background: 'rgba(255,248,234,0.06)',
    color: 'rgba(255,248,234,0.7)',
    border: '1.5px solid rgba(255,248,234,0.22)',
  },
}

// Compact CTA — one parametrised button matching the landing button language.
function CTA({ label, onClick, variant, delay }: { label: string; onClick: () => void; variant: Variant; delay: number }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }
  return (
    <motion.button
      onClick={fire}
      initial={{ y: 22, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 190, damping: 17 }}
      whileTap={{ scale: 0.94 }}
      className="relative w-full py-[14px] lg:py-[16px] rounded-2xl overflow-hidden font-inter font-semibold text-[14px] tracking-wide"
      style={VARIANT_STYLE[variant]}
    >
      {variant === 'primary' && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.24) 50%, transparent 80%)',
            animation: 'shine-sweep 3.4s ease-in-out 2s infinite',
          }}
        />
      )}
      <AnimatePresence>
        {tapped && (
          <motion.span
            key="rpl"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ scale: 0.55, opacity: 0.5 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: 'rgba(255,255,255,0.25)' }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10">{label}</span>
    </motion.button>
  )
}

// ── Reel landing — a cycling reel of distinct clips fills the screen ──────────
export function LandingReel({ onOpenMenu, onRecommend, onWaiter }: Props) {
  const { posterOnly } = useMediaMode()
  const [idx, setIdx] = useState(0)
  const current = REEL[idx]

  // Advance the reel on a timer (paused in image mode).
  useEffect(() => {
    if (posterOnly) return
    const t = setInterval(() => setIdx(i => (i + 1) % REEL.length), 5000)
    return () => clearInterval(t)
  }, [posterOnly])

  return (
    <div className="relative flex flex-col min-h-full overflow-hidden" style={{ background: '#0B0305' }}>
      {/* Full-bleed cycling reel — each clip crossfades into the next */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <AnimatePresence>
          <motion.div
            key={current.key}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.1 }, scale: { duration: 5.2, ease: 'linear' } }}
          >
            <LqipVideo
              renditions={videoRenditions(current.key)}
              poster={current.poster}
              alt={current.label}
              play="eager"
              posterOnly={posterOnly}
              wrapperStyle={{ position: 'absolute', inset: 0 }}
              videoClassName="w-full h-full object-cover"
              placeholder="linear-gradient(155deg, #120608 0%, #3E1A04 40%, #0B0305 100%)"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Top gold accent + thin top scrim only (keeps the upper ~60% pure video) */}
      <div
        className="absolute top-0 inset-x-0 h-[3px]"
        style={{ zIndex: 20, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }}
      />
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ zIndex: 10, height: '22%', background: 'linear-gradient(to bottom, rgba(4,1,3,0.7), transparent)' }}
      />

      {/* LIVE pill — signals it's video */}
      {!posterOnly && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ zIndex: 22, background: 'rgba(4,1,3,0.55)', border: '1px solid rgba(217,160,58,0.4)' }}
        >
          <Play size={9} strokeWidth={3} style={{ color: '#D9A03A', fill: '#D9A03A' }} />
          <AnimatePresence mode="wait">
            <motion.span
              key={current.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="font-inter uppercase tracking-[0.22em]"
              style={{ fontSize: 8, color: 'rgba(217,160,58,0.95)' }}
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}

      <div className="flex-1" style={{ minHeight: '52vh' }} />

      {/* Frosted CTA card — video stays visible above it */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full px-6 pb-10 lg:pb-14"
        style={{ zIndex: 20, maxWidth: 'min(92vw, 520px)' }}
      >
        <div
          className="rounded-3xl px-6 pt-6 pb-6 flex flex-col items-center"
          style={{
            background: 'rgba(11,3,5,0.55)',
            border: '1px solid rgba(217,160,58,0.28)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="font-playfair font-bold text-center"
            style={{ fontSize: 'clamp(40px, 12vw, 76px)', color: '#FFF8EA', letterSpacing: '-0.02em', lineHeight: 0.95, textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}
          >
            RELISH
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="font-cormorant italic mt-1 mb-5 text-center"
            style={{ fontSize: 'clamp(15px, 2vw, 21px)', color: 'rgba(255,248,234,0.74)' }}
          >
            Every dish, in motion
          </motion.p>

          <div className="flex flex-col gap-2.5 w-full">
            <CTA label="Open Menu" onClick={onOpenMenu} variant="primary" delay={0.7} />
            <CTA label="✦ Recommend Something" onClick={onRecommend} variant="gold" delay={0.8} />
            <CTA label="Call Waiter" onClick={onWaiter} variant="ghost" delay={0.9} />
          </div>
        </div>
      </motion.div>

      {/* Bottom gold accent */}
      <div
        className="absolute bottom-0 inset-x-0 h-[3px]"
        style={{ zIndex: 30, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }}
      />
    </div>
  )
}
