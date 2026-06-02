import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LqipVideo } from '../components/atoms/LqipVideo'
import { useMediaMode } from '../theme/MediaModeContext'
import { videoRenditions } from '../data/videoManifest'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

const HERO_POSTER_SRC = '/assets/dishes/soup-001-hero.webp'

// A short strip of looping dish videos that signals the video-heavy menu.
const CHIPS = [
  { key: 'soups',     poster: '/assets/dishes/soup-001-hero.webp', label: 'Soups' },
  { key: 'italian',   poster: '/assets/dishes/ita-001-hero.webp',  label: 'Italian' },
  { key: 'desserts',  poster: '/assets/dishes/des-001-hero.webp',  label: 'Sweets' },
  { key: 'beverages', poster: '/assets/dishes/bev-001-hero.webp',  label: 'Drinks' },
] as const

// ── Animated primary button (Open Menu) — verbatim from LandingCover ─────────
function PrimaryBtn({ onClick, delay }: { onClick: () => void; delay: number }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <motion.button
      onClick={fire}
      initial={{ x: -56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 190, damping: 16 }}
      whileTap={{ scale: 0.93 }}
      className="relative w-full py-[15px] lg:py-[17px] rounded-2xl overflow-hidden font-inter font-semibold text-[14px] lg:text-[15px] tracking-wide"
      style={{
        background: 'linear-gradient(135deg, #7A0E1E 0%, #A52030 45%, #8B1024 100%)',
        color: '#FFF8EA',
        border: 'none',
        boxShadow: '0 6px 28px rgba(139,16,36,0.52), 0 1px 0 rgba(255,255,255,0.1) inset',
      }}
    >
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.26) 50%, transparent 80%)',
          animation: 'shine-sweep 3.4s ease-in-out 2s infinite',
        }}
      />
      <AnimatePresence>
        {tapped && (
          <motion.span
            key="rpl"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ scale: 0.55, opacity: 0.55 }}
            animate={{ scale: 2.6, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10">Open Menu</span>
    </motion.button>
  )
}

// ── Gold recommend button — verbatim from LandingCover ───────────────────────
function GoldBtn({ onClick, delay }: { onClick: () => void; delay: number }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <motion.button
      onClick={fire}
      initial={{ x: 56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 190, damping: 16 }}
      whileTap={{ scale: 0.93 }}
      className="relative w-full py-[15px] lg:py-[17px] rounded-2xl overflow-hidden font-inter font-medium text-[14px] lg:text-[15px] tracking-wide"
      style={{
        background: 'linear-gradient(135deg, rgba(217,160,58,0.16) 0%, rgba(200,140,30,0.08) 100%)',
        color: '#D9A03A',
        border: '1.5px solid rgba(217,160,58,0.60)',
        boxShadow: '0 3px 18px rgba(217,160,58,0.28)',
        animation: 'gold-pulse 3s ease-in-out 3s infinite',
      }}
    >
      <AnimatePresence>
        {tapped && (
          <motion.span
            key="grpl"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ scale: 0.55, opacity: 0.5 }}
            animate={{ scale: 2.6, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: 'rgba(217,160,58,0.42)' }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 flex items-center justify-center gap-2">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'inline-block', fontSize: 11, lineHeight: 1 }}
        >
          ✦
        </motion.span>
        Recommend Something
      </span>
    </motion.button>
  )
}

// ── Ghost waiter button — verbatim from LandingCover ─────────────────────────
function GhostBtn({ onClick, delay }: { onClick: () => void; delay: number }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <motion.button
      onClick={fire}
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 190, damping: 18 }}
      whileTap={{ scale: 0.95 }}
      className="relative w-full py-[15px] lg:py-[17px] rounded-2xl overflow-hidden font-inter font-medium text-[13.5px] lg:text-[15px] tracking-wide"
      style={{
        background: 'transparent',
        color: 'rgba(255,248,234,0.52)',
        border: '1.5px solid rgba(255,248,234,0.18)',
        animation: 'ghost-breathe 3s ease-in-out 3.5s infinite',
      }}
    >
      <AnimatePresence>
        {tapped && (
          <motion.span
            key="grpl2"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ scale: 0.55, opacity: 0.35 }}
            animate={{ scale: 2.6, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: 'rgba(255,248,234,0.12)' }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10">Call Waiter</span>
    </motion.button>
  )
}

// ── Cinematic landing — full-bleed looping hero video + chip strip ───────────
export function LandingCinematic({ onOpenMenu, onRecommend, onWaiter }: Props) {
  const { posterOnly } = useMediaMode()

  return (
    <div className="relative flex flex-col min-h-full overflow-hidden" style={{ background: '#0B0305' }}>
      {/* Tier 1 — full-bleed looping hero video (poster + play-on-visible + fallback handled inside) */}
      <LqipVideo
        renditions={videoRenditions('hero')}
        poster={HERO_POSTER_SRC}
        alt="Relish — cinematic dining"
        play="eager"
        posterOnly={posterOnly}
        wrapperStyle={{ position: 'absolute', inset: 0, zIndex: 0 }}
        videoClassName="w-full h-full object-cover"
        placeholder="linear-gradient(155deg, #120608 0%, #3E1A04 28%, #A85A0C 52%, #220A0C 80%, #0B0305 100%)"
      />

      {/* Top gold accent bar */}
      <div
        className="absolute top-0 inset-x-0 h-[3px]"
        style={{ zIndex: 20, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }}
      />

      {/* Bottom vignette for legibility — kept lighter/shorter so the film reads clearly */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          zIndex: 10,
          height: '58%',
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(8,3,6,0.30) 26%, rgba(5,1,4,0.74) 56%, rgba(4,1,3,0.95) 82%, rgba(4,1,3,1) 100%)',
        }}
      />

      {/* Spacer — let the film breathe up top (bigger so video dominates the upper half) */}
      <div className="flex-1" style={{ minHeight: '42vh' }} />

      {/* RELISH wordmark — clip-wipe reveal */}
      <motion.div
        initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
        animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
        transition={{ delay: 0.35, duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center px-8"
        style={{ zIndex: 20 }}
      >
        <h1
          className="font-playfair font-bold text-center"
          style={{
            fontSize: 'clamp(54px, 15vw, 116px)',
            color: '#FFF8EA',
            letterSpacing: '-0.02em',
            lineHeight: 0.9,
            textShadow: '0 2px 30px rgba(0,0,0,0.6)',
          }}
        >
          RELISH
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.85, duration: 0.7 }}
          className="font-cormorant italic mt-2 text-center"
          style={{ fontSize: 'clamp(15px, 2vw, 23px)', color: 'rgba(255,248,234,0.74)' }}
        >
          A journey through flavours of the world
        </motion.p>
      </motion.div>

      {/* Autoplaying dish-video chip strip */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.55 }}
        className="relative flex gap-2.5 px-5 mt-5 overflow-x-auto no-scrollbar justify-center"
        style={{ zIndex: 20 }}
      >
        {CHIPS.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.05 + i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
            className="relative flex-shrink-0 rounded-xl overflow-hidden"
            style={{ width: 64, height: 84, border: '1px solid rgba(217,160,58,0.4)' }}
          >
            <LqipVideo
              renditions={videoRenditions(c.key)}
              poster={c.poster}
              alt={c.label}
              posterOnly={posterOnly}
              wrapperStyle={{ position: 'absolute', inset: 0 }}
              videoClassName="w-full h-full object-cover"
            />
            <span
              className="absolute bottom-0 inset-x-0 text-center font-inter uppercase tracking-wider py-0.5"
              style={{ fontSize: 7.5, background: 'rgba(4,1,3,0.7)', color: 'rgba(217,160,58,0.92)', zIndex: 2 }}
            >
              {c.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTAs */}
      <div
        className="relative flex flex-col items-center pb-10 lg:pb-16 px-8 mx-auto w-full"
        style={{ zIndex: 20, maxWidth: 'min(92vw, 680px)' }}
      >
        <div className="flex flex-col gap-3 w-full max-w-[268px] sm:max-w-[360px] lg:max-w-[420px] mt-7">
          <PrimaryBtn onClick={onOpenMenu} delay={1.25} />
          <GoldBtn onClick={onRecommend} delay={1.38} />
          <GhostBtn onClick={onWaiter} delay={1.5} />
        </div>
      </div>

      {/* Bottom gold accent bar */}
      <div
        className="absolute bottom-0 inset-x-0 h-[3px]"
        style={{ zIndex: 30, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }}
      />
    </div>
  )
}
