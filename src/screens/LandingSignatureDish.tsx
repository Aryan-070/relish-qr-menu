import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, Leaf, Sparkles } from 'lucide-react'

interface DishConfig {
  id: string
  name: string
  subtitle: string
  image: string
  gradientFrom: string
  gradientTo: string
  accentColor: string
  price: number
}

interface TappedParticle {
  src: string
  label: string
  price: number
}

const DISHES: DishConfig[] = [
  {
    id: 'bev-005',
    name: 'Virgin Mojito',
    subtitle: 'House Cooler',
    image: '/assets/dishes/bev-005-hero.webp',
    gradientFrom: '#EEF6E9',
    gradientTo: '#DCEBD7',
    accentColor: '#5C9168',
    price: 170,
  },
  {
    id: 'ita-004',
    name: 'Margherita Pizza',
    subtitle: 'Stone-fired Classic',
    image: '/assets/dishes/ita-004-hero.webp',
    gradientFrom: '#FBF4E7',
    gradientTo: '#F3E6CE',
    accentColor: '#C06B3E',
    price: 320,
  },
  {
    id: 'des-001',
    name: 'Tiramisu',
    subtitle: 'Italian Dream',
    image: '/assets/dishes/des-001-hero.webp',
    gradientFrom: '#F7F1E8',
    gradientTo: '#ECDFCC',
    accentColor: '#8A6242',
    price: 280,
  },
  {
    id: 'qb-005',
    name: 'Paneer Tikka',
    subtitle: 'Tandoor Special',
    image: '/assets/dishes/qb-005-hero.webp',
    gradientFrom: '#FBF2EB',
    gradientTo: '#F5E1D2',
    accentColor: '#C25E3C',
    price: 260,
  },
  {
    id: 'bev-003',
    name: 'Cold Coffee',
    subtitle: 'House Blend',
    image: '/assets/dishes/bev-003-hero.webp',
    gradientFrom: '#F4EEE7',
    gradientTo: '#E6D8CA',
    accentColor: '#7C5A42',
    price: 160,
  },
  {
    id: 'des-002',
    name: 'Choco Lava Cake',
    subtitle: 'Warm & Indulgent',
    image: '/assets/dishes/des-002-hero.webp',
    gradientFrom: '#F8F1F7',
    gradientTo: '#EADEEE',
    accentColor: '#8A5BA8',
    price: 260,
  },
]

// Fixed peripheral positions for 5 nav bubbles.
// Strictly on far-left/far-right edges in the vertical middle band so they
// never overlap the variant switcher (top-right), CTA buttons (bottom), or
// the dish label — only the hero's bleeding edges (intentional, layered look).
const BUBBLE_POSITIONS = [
  { left: '1%',  top: '15%' },   // top-left (left of centered title)
  { left: '83%', top: '30%' },   // right edge (below switcher ~25%)
  { left: '0%',  top: '36%' },   // left edge upper-mid
  { left: '84%', top: '50%' },   // right edge lower-mid
  { left: '2%',  top: '54%' },   // left edge lower (above dish label)
]
const BUBBLE_SIZES    = [58, 50, 54, 46, 50]
const BUBBLE_FLOAT    = ['bubble-float-a', 'bubble-float-b', 'bubble-float-c', 'bubble-float-a', 'bubble-float-b']
const BUBBLE_DURATIONS = [3.2, 2.8, 3.6, 2.5, 3.0]

const BADGES = [
  { label: '100% Veg',    Icon: Sprout },
  { label: 'Jain Options', Icon: Leaf },
  { label: 'Fresh Daily',  Icon: Sparkles },
]
const BADGE_ANIMS = ['badge-bob', 'badge-pulse', 'badge-twinkle']

// ── Ambient ingredient bubbles (decorative, roam + breathe + pop + respawn) ──
const INGREDIENTS_BY_DISH: Record<string, string[]> = {
  'bev-005': ['lemon', 'mint', 'ice-cube', 'sugar'],
  'ita-004': ['basil', 'tomato', 'mozzarella', 'olive'],
  'des-001': ['coffee-bean', 'cocoa', 'cream', 'chocolate'],
  'qb-005': ['chilli', 'onion', 'paneer', 'mint'],
  'bev-003': ['coffee-bean', 'ice-cube', 'cream', 'cocoa'],
  'des-002': ['chocolate', 'strawberry', 'cocoa', 'cherry'],
}

const AMBIENT_ROAMS = ['ambient-roam-a', 'ambient-roam-b', 'ambient-roam-c']

// Ingredient image with frosted-orb fallback (until PNGs exist)
function IngredientImg({ src, accent }: { src: string; accent: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), ${accent}55 70%, ${accent}30)`,
        boxShadow: `inset 0 -3px 8px ${accent}30, 0 4px 12px rgba(0,0,0,0.10)`,
        border: '1px solid rgba(255,255,255,0.6)',
      }} />
    )
  }
  return (
    <img
      src={`/assets/ingredients/${src}.png`}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 5px 12px rgba(0,0,0,0.16))' }}
      draggable={false}
    />
  )
}

// One persistent slot: pops out and reforms with a new ingredient/position each cycle.
// Fixed identity (keyed by index) — never added/removed, so it cannot leak.
function AmbientSlot({ ingredients, accent, idx }: { ingredients: string[]; accent: string; idx: number }) {
  const dur = 5.5 + (idx % 5) * 0.8
  const roam = AMBIENT_ROAMS[idx % AMBIENT_ROAMS.length]

  const pick = useCallback(() => {
    const onLeft = Math.random() < 0.5
    return {
      src: ingredients[Math.floor(Math.random() * ingredients.length)] ?? 'mint',
      left: onLeft ? 2 + Math.random() * 22 : 64 + Math.random() * 24,  // 2–24% or 64–88%
      top: 14 + Math.random() * 46,                                     // 14–60%
      size: 36 + Math.random() * 26,
    }
  }, [ingredients])

  const [slot, setSlot] = useState(pick)

  // Refresh ingredient/position on dish change + once per pop cycle (at the invisible trough)
  useEffect(() => {
    setSlot(pick())
    const iv = setInterval(() => setSlot(pick()), dur * 1000)
    return () => clearInterval(iv)
  }, [pick, dur])

  return (
    <div className="absolute" style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: slot.size, height: slot.size }}>
      <motion.div
        style={{ width: '100%', height: '100%' }}
        animate={{ scale: [0, 1, 1, 0], opacity: [0, 0.9, 0.9, 0] }}
        transition={{ duration: dur, times: [0, 0.18, 0.82, 1], repeat: Infinity, ease: 'easeInOut', delay: idx * 0.6 }}
      >
        {/* Inner div: perpetual CSS roam + breathe */}
        <div style={{ width: '100%', height: '100%', animation: `${roam} ${(dur * 0.9).toFixed(2)}s ease-in-out infinite` }}>
          <IngredientImg src={slot.src} accent={accent} />
        </div>
      </motion.div>
    </div>
  )
}

function AmbientBubbles({ dishId, accent }: { dishId: string; accent: string }) {
  const ingredients = INGREDIENTS_BY_DISH[dishId] ?? []
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 8, overflow: 'hidden' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <AmbientSlot key={i} ingredients={ingredients} accent={accent} idx={i} />
      ))}
    </div>
  )
}

// ── Pulsing aura rings around hero dish ──────────────────────────────────────
function AuraRings({ color, size = 326 }: { color: string; size?: number | string }) {
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            width: size,
            height: size,
            border: `1.5px solid ${color}`,
            borderRadius: '50%',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 1.14 + i * 0.08, 1],
            opacity: [0.42 - i * 0.12, 0, 0.42 - i * 0.12],
          }}
          transition={{
            duration: 2.5 + i * 0.55,
            repeat: Infinity,
            delay: i * 0.55,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  )
}

// ── Word-by-word blur-focus tagline ──────────────────────────────────────────
function TaglineReveal({ trigger }: { trigger: number }) {
  const words = 'A journey through flavours of the world'.split(' ')
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`tagline-${trigger}`}
        className="font-cormorant italic text-center mb-2.5"
        style={{ fontSize: 15, color: 'rgba(42,30,30,0.60)', lineHeight: 1.6, minHeight: '1.5em' }}
      >
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 7, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.04 + i * 0.09, duration: 0.48, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ display: 'inline-block', marginRight: '0.3em' }}
          >
            {word}
          </motion.span>
        ))}
      </motion.p>
    </AnimatePresence>
  )
}

// ── Dish popup card ──────────────────────────────────────────────────────────
function DishPopup({
  particle,
  onDismiss,
  onOpenMenu,
}: {
  particle: TappedParticle
  onDismiss: () => void
  onOpenMenu: () => void
}) {
  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 40,
          background: 'rgba(42,30,30,0.22)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onDismiss}
      />
      <motion.div
        className="absolute"
        style={{ left: '50%', top: '38%', transform: 'translate(-50%, -50%)', zIndex: 50 }}
        initial={{ scale: 0.72, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.72, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <div
          style={{
            width: 196,
            background: 'rgba(255,248,234,0.96)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 22,
            padding: '18px 16px 16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.10)',
            border: '1px solid rgba(255,255,255,0.88)',
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', border: '2.5px solid rgba(217,160,58,0.55)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            <img src={particle.src} alt={particle.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <p className="font-playfair font-bold text-center" style={{ fontSize: 15, color: '#2A1E1E', margin: 0, lineHeight: 1.3 }}>
            {particle.label}
          </p>
          <span className="font-inter font-semibold" style={{ fontSize: 13, color: '#8B1024', background: 'rgba(139,16,36,0.08)', padding: '2px 10px', borderRadius: 20 }}>
            ₹{particle.price}
          </span>
          <div style={{ width: '80%', height: 1, background: 'linear-gradient(to right, transparent, rgba(217,160,58,0.42), transparent)' }} />
          <button
            onClick={() => { onDismiss(); onOpenMenu() }}
            className="font-inter font-semibold w-full"
            style={{ fontSize: 12, color: '#FFF8EA', background: 'linear-gradient(135deg, #7A0E1E, #8B1024)', border: 'none', borderRadius: 12, padding: '9px 0', cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 4px 14px rgba(139,16,36,0.30)' }}
          >
            View in Menu
          </button>
          <p className="font-cormorant italic" style={{ fontSize: 11, color: 'rgba(42,30,30,0.36)', margin: 0 }}>
            tap anywhere to close
          </p>
        </div>
      </motion.div>
    </>
  )
}

function useCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // `restart` is bumped on every manual nav so the dwell timer resets; bumping
  // it (rather than poking a ref) keeps a SINGLE effect-owned interval alive.
  const [restart, setRestart] = useState(0)
  const touchStartX = useRef(0)

  // Single owner of the auto-advance interval. The id is a local const captured
  // by the cleanup, so React (and Vite HMR) always clears the exact interval it
  // created — no ref that can survive a hot update and stack duplicate timers.
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % DISHES.length)
    }, 3500)
    return () => clearInterval(id)
  }, [paused, restart])

  const select = useCallback((i: number) => {
    setActiveIndex(i)
    setRestart(r => r + 1) // give the picked dish a fresh full dwell
  }, [])

  const advance = useCallback((dir: 'left' | 'right') => {
    setActiveIndex(prev =>
      dir === 'right'
        ? (prev + 1) % DISHES.length
        : (prev - 1 + DISHES.length) % DISHES.length
    )
    setRestart(r => r + 1)
  }, [])

  const stopTimer = useCallback(() => setPaused(true), [])
  const resumeTimer = useCallback(() => setPaused(false), [])

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) advance(dx < 0 ? 'right' : 'left')
  }

  return { activeIndex, select, stopTimer, resumeTimer, handleTouchStart, handleTouchEnd }
}

// ── Electric Open Menu ───────────────────────────────────────────────────────
function ElectricOpenMenuBtn({ onClick }: { onClick: () => void }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <div className="relative w-full" style={{ padding: 2, borderRadius: 18 }}>
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 18, background: 'conic-gradient(from var(--conic-angle, 0deg), #8B1024 0%, #D9A03A 22%, #FFF8EA 38%, #D9A03A 55%, #8B1024 72%, transparent 82%, transparent 100%)', animation: 'conic-spin 2.8s linear infinite' }} />
      <motion.button onClick={fire} whileTap={{ scale: 0.93 }}
        className="relative w-full py-[14px] rounded-2xl overflow-hidden font-inter font-semibold text-[14px] tracking-wide"
        style={{ background: 'linear-gradient(135deg, #7A0E1E 0%, #A52030 45%, #8B1024 100%)', color: '#FFF8EA', border: 'none', boxShadow: '0 4px 22px rgba(139,16,36,0.38)' }}>
        <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.22) 50%, transparent 80%)', animation: 'shine-sweep 3.4s ease-in-out 2s infinite' }} />
        <AnimatePresence>
          {tapped && <motion.span key="rpl" className="absolute inset-0 rounded-2xl pointer-events-none" initial={{ scale: 0.55, opacity: 0.5 }} animate={{ scale: 2.6, opacity: 0 }} exit={{}} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ background: 'rgba(255,255,255,0.25)' }} />}
        </AnimatePresence>
        <span className="relative z-10">Open Menu</span>
      </motion.button>
    </div>
  )
}

function LightGoldBtn({ onClick }: { onClick: () => void }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <motion.button onClick={fire} initial={{ x: 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.12, type: 'spring', stiffness: 190, damping: 16 }}
      whileTap={{ scale: 0.93 }}
      className="relative w-full py-[14px] rounded-2xl overflow-hidden font-inter font-medium text-[14px] tracking-wide"
      style={{ background: 'rgba(217,160,58,0.10)', color: '#9E6E18', border: '1.5px solid rgba(217,160,58,0.55)', boxShadow: '0 3px 14px rgba(217,160,58,0.18)', animation: 'gold-pulse 3s ease-in-out 3s infinite' }}>
      <AnimatePresence>
        {tapped && <motion.span key="grpl" className="absolute inset-0 rounded-2xl pointer-events-none" initial={{ scale: 0.55, opacity: 0.5 }} animate={{ scale: 2.6, opacity: 0 }} exit={{}} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ background: 'rgba(217,160,58,0.35)' }} />}
      </AnimatePresence>
      <span className="relative z-10 flex items-center justify-center gap-2">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex', lineHeight: 1 }}><Sparkles size={12} strokeWidth={2} /></motion.span>
        Recommend Something
      </span>
    </motion.button>
  )
}

function LightGhostBtn({ onClick }: { onClick: () => void }) {
  const [tapped, setTapped] = useState(false)
  const fire = () => { setTapped(true); onClick(); setTimeout(() => setTapped(false), 700) }

  return (
    <motion.button onClick={fire} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.22, type: 'spring', stiffness: 190, damping: 18 }}
      whileTap={{ scale: 0.95 }}
      className="relative w-full py-[14px] rounded-2xl overflow-hidden font-inter font-medium text-[13.5px] tracking-wide"
      style={{ background: 'transparent', color: 'rgba(42,30,30,0.48)', border: '1.5px solid rgba(139,16,36,0.22)', animation: 'ghost-breathe 3s ease-in-out 3.5s infinite' }}>
      <AnimatePresence>
        {tapped && <motion.span key="grpl2" className="absolute inset-0 rounded-2xl pointer-events-none" initial={{ scale: 0.55, opacity: 0.35 }} animate={{ scale: 2.6, opacity: 0 }} exit={{}} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ background: 'rgba(139,16,36,0.08)' }} />}
      </AnimatePresence>
      <span className="relative z-10">Call Waiter</span>
    </motion.button>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

export function LandingSignatureDish({ onOpenMenu, onRecommend, onWaiter }: Props) {
  const { activeIndex, select, stopTimer, resumeTimer, handleTouchStart, handleTouchEnd } = useCarousel()
  const [tappedParticle, setTappedParticle] = useState<TappedParticle | null>(null)
  const dish = DISHES[activeIndex]

  // Hero plate size — fluid, bounded by the short axis (vmin) so it never
  // causes vertical clip in the fixed-height (100dvh, overflow:hidden) shell.
  const HERO = 'clamp(318px, 42vmin, 420px)'

  // Pause carousel while popup is open
  useEffect(() => {
    if (tappedParticle) stopTimer()
    else resumeTimer()
  }, [tappedParticle, stopTimer, resumeTimer])

  return (
    <div
      className="relative flex flex-col h-full select-none"
      style={{ minHeight: '100%', overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Full-screen background gradient ──────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dish.id + '-bg'}
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${dish.gradientFrom} 0%, ${dish.gradientTo} 100%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      </AnimatePresence>

      {/* Subtle dot texture */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.022) 1px, transparent 0)', backgroundSize: '22px 22px' }} />

      {/* Warm comfort glow + edge vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(120% 80% at 50% 38%, rgba(255,250,240,0.55) 0%, rgba(255,250,240,0) 45%),' +
          'radial-gradient(140% 110% at 50% 50%, rgba(70,45,30,0) 60%, rgba(70,45,30,0.08) 100%)',
        zIndex: 1,
      }} />

      {/* Ambient ingredient bubbles — roam, breathe, pop, respawn */}
      <AmbientBubbles dishId={dish.id} accent={dish.accentColor} />

      {/* ── Popup ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {tappedParticle && (
          <DishPopup
            particle={tappedParticle}
            onDismiss={() => setTappedParticle(null)}
            onOpenMenu={onOpenMenu}
          />
        )}
      </AnimatePresence>

      {/* ── Top gold accent bar ───────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none" style={{ height: 3, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }} />

      {/* ══ Centered content column ══════════════════════════════════
           Full-bleed gradient/glow/ambient/popup stay behind & around;
           interactive content (header, hero universe, label, dots, CTA)
           lives in a centered max-w column so the orbit metaphor and
           fixed-px hero stay coherent on wide screens. The bubbles'
           % positions now resolve against THIS column, not the viewport. */}
      <div className="relative z-10 flex flex-col flex-1 mx-auto w-full" style={{ maxWidth: 'min(94vw, 780px)' }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col items-center pt-11 pb-1">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18, duration: 0.7 }}
          className="font-inter uppercase"
          style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(42,30,30,0.45)' }}>
          — Tonight's Table —
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30, type: 'spring', stiffness: 200, damping: 20 }}
          className="font-playfair font-bold leading-none mt-1"
          style={{
            fontSize: 'clamp(50px, 7vw, 84px)',
            letterSpacing: '-0.025em',
            background: 'linear-gradient(120deg, #8B1024 0%, #C84030 18%, #D9A03A 38%, #FFF4D6 50%, #D9A03A 62%, #C84030 82%, #8B1024 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'relish-shimmer 2.8s linear infinite',
          }}
        >
          Relish
        </motion.h1>
      </div>

      {/* ── Hero dish + 5 nav bubbles ──────────────────────────────
           Decoupled & robust: the hero crossfades in at full size (keyed by
           dish.id) so it ALWAYS renders correctly — it never depends on a
           shared-element layout morph completing. The bubbles are independent
           floating nav buttons. This removes the whole class of layoutId-morph
           bugs (image collapse, frames stuck mid-transition). */}
      <>

        {/* 5 floating nav bubbles — non-active dishes */}
        {DISHES.filter(d => d.id !== dish.id).map((d, bIdx) => (
          <div
            key={d.id}
            className="absolute"
            style={{
              left: BUBBLE_POSITIONS[bIdx].left,
              top: BUBBLE_POSITIONS[bIdx].top,
              width: BUBBLE_SIZES[bIdx],
              height: BUBBLE_SIZES[bIdx],
              zIndex: 15,
              animation: `${BUBBLE_FLOAT[bIdx]} ${BUBBLE_DURATIONS[bIdx]}s ease-in-out infinite`,
            }}
          >
            <motion.button
              className="cursor-pointer"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                padding: 0,
                border: 'none',
                background: 'transparent',
                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.72), 0 4px 18px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.10)',
              }}
              onClick={() => select(DISHES.findIndex(x => x.id === d.id))}
              whileTap={{ scale: 1.18 }}
              aria-label={`View ${d.name}`}
            >
              <img src={d.image} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
            </motion.button>
          </div>
        ))}

        {/* Hero dish area */}
        <div className="relative z-10 flex-1 flex items-center justify-center" style={{ minHeight: 220 }}>
          {/* Aura rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div key={dish.id + '-aura'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <AuraRings color={dish.accentColor + 'AA'} size={'clamp(326px, 43vmin, 430px)'} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* The hero plate — robust crossfade. Always rendered at full HERO
              size; a new dish fades/scales in while the old one fades out, so
              the active dish can never be left stuck at a tiny/partial size. */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, opacity: { duration: 0.35 } }}
              style={{
                width: HERO,
                height: HERO,
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: `inset 0 0 0 5px rgba(255,255,255,0.86), 0 28px 90px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12), 0 0 0 8px ${dish.accentColor}35`,
                cursor: 'pointer',
                zIndex: 10,
              }}
              onClick={() => setTappedParticle({ src: dish.image, label: dish.name, price: dish.price })}
              whileTap={{ scale: 0.96 }}
            >
              <img src={dish.image} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
            </motion.div>
          </AnimatePresence>
        </div>

      </>

      {/* ── Dish name label ───────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-6" style={{ minHeight: 46 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={dish.id + '-label'}
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <h2 className="font-playfair font-bold leading-tight" style={{ fontSize: 20, color: dish.accentColor }}>{dish.name}</h2>
            <p className="font-cormorant italic mt-0.5" style={{ fontSize: 13, color: 'rgba(42,30,30,0.50)' }}>{dish.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Progress pill dots ────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-center gap-2 mt-2">
        {DISHES.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => select(i)}
            animate={{ width: i === activeIndex ? 24 : 6, background: i === activeIndex ? dish.accentColor : 'rgba(42,30,30,0.18)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label={`View ${DISHES[i].name}`}
          />
        ))}
      </div>

      {/* ── CTA Panel (transparent — shares full gradient) ────────── */}
      <div className="relative z-10 w-full mt-2 px-5 pb-8 pt-4">
        <TaglineReveal trigger={activeIndex} />

        <div className="flex items-center justify-center gap-1.5 mb-3.5">
          {BADGES.map((b, i) => (
            <span key={b.label} className="font-inter uppercase tracking-wide rounded-full inline-flex items-center gap-1"
              style={{ fontSize: 8, letterSpacing: '0.10em', padding: '3px 8px', background: `${dish.accentColor}12`, border: `1px solid ${dish.accentColor}40`, color: dish.accentColor, animation: `${BADGE_ANIMS[i]} 2.4s ease-in-out ${i * 0.38}s infinite`, transition: 'color 0.6s ease, border-color 0.6s ease, background 0.6s ease' }}>
              <b.Icon size={9} strokeWidth={2.25} /> {b.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2 w-full max-w-[268px] mx-auto">
          <ElectricOpenMenuBtn onClick={onOpenMenu} />
          <LightGoldBtn onClick={onRecommend} />
          <LightGhostBtn onClick={onWaiter} />
        </div>
      </div>

      </div>
      {/* ── End centered content column ───────────────────────────── */}

      {/* ── Bottom gold accent bar ────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none" style={{ height: 3, background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))' }} />

      {/* ── Refined corner ornaments (double-line + diamond accent) ── */}
      {[
        { cls: 'top-4 left-3',     outer: 'M2 42 L2 2 L42 2',   inner: 'M8 34 L8 8 L34 8',   dx: 8,  dy: 8  },
        { cls: 'top-4 right-3',    outer: 'M42 42 L42 2 L2 2',  inner: 'M36 34 L36 8 L10 8', dx: 36, dy: 8  },
        { cls: 'bottom-4 left-3',  outer: 'M2 2 L2 42 L42 42',  inner: 'M8 10 L8 36 L34 36', dx: 8,  dy: 36 },
        { cls: 'bottom-4 right-3', outer: 'M42 2 L42 42 L2 42', inner: 'M36 10 L36 36 L10 36', dx: 36, dy: 36 },
      ].map(({ cls, outer, inner, dx, dy }, i) => (
        <svg key={i} className={`absolute ${cls} pointer-events-none`} width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ zIndex: 22, opacity: 0.5 }}>
          <defs>
            <linearGradient id={`ornGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B1024" />
              <stop offset="100%" stopColor="#D9A03A" />
            </linearGradient>
          </defs>
          <path d={outer} stroke={`url(#ornGrad-${i})`} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d={inner} stroke={`url(#ornGrad-${i})`} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" />
          <path d={`M${dx} ${dy - 3} L${dx + 3} ${dy} L${dx} ${dy + 3} L${dx - 3} ${dy} Z`} fill={`url(#ornGrad-${i})`} />
        </svg>
      ))}
    </div>
  )
}
