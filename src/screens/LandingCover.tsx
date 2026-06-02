import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

// ─── Hero media configuration ─────────────────────────────────────────────────
// Priority: Kling AI video → HyperFrames HTML composition → CSS fallback
//
// ACTIVE — HyperFrames 3-scene cinematic composition (full-screen background)
const HERO_HTML_SRC = '/assets/hero-reel.html'
//
// FUTURE — swap in once Kling AI export is ready:
const HERO_VIDEO_SRC = ''      // '/assets/hero-reel.mp4'
const HERO_POSTER_SRC = ''     // '/assets/hero-poster.jpg'
// ──────────────────────────────────────────────────────────────────────────────

// ── Animated primary button (Open Menu) ──────────────────────────────────────
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
      {/* Shimmer sweep */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.26) 50%, transparent 80%)',
          animation: 'shine-sweep 3.4s ease-in-out 2s infinite',
        }}
      />
      {/* Tap ripple burst */}
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

// ── Gold recommend button ────────────────────────────────────────────────────
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
      {/* Tap ripple */}
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

// ── Ghost waiter button ──────────────────────────────────────────────────────
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
      {/* Tap ripple */}
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

// ── Main landing ─────────────────────────────────────────────────────────────
export function LandingCover({ onOpenMenu, onRecommend, onWaiter }: Props) {
  return (
    <div
      className="relative flex flex-col min-h-full overflow-hidden"
      style={{ background: '#0B0305' }}
    >
      {/* ══════════════════════════════════════════════════════════════════
           FULL-SCREEN BACKGROUND LAYER (z-0)
           HyperFrames cinematic composition or Kling AI video fills the
           entire viewport. React content overlays on top.
      ══════════════════════════════════════════════════════════════════ */}
      {HERO_VIDEO_SRC ? (
        /* Tier 1 — Kling AI video */
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER_SRC}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
          src={HERO_VIDEO_SRC}
        />
      ) : HERO_HTML_SRC ? (
        /* Tier 2 — HyperFrames HTML composition */
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <iframe
            src={HERO_HTML_SRC}
            title="Relish hero animation"
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            scrolling="no"
            loading="eager"
          />
        </div>
      ) : (
        /* Tier 3 — CSS atmospheric fallback */
        <div
          className="absolute inset-0"
          style={{
            zIndex: 0,
            background: 'linear-gradient(155deg, #120608 0%, #3E1A04 28%, #A85A0C 52%, #220A0C 80%, #0B0305 100%)',
          }}
        />
      )}

      {/* ── Top gold accent bar ───────────────────────────────────────── */}
      <div
        className="absolute top-0 inset-x-0 h-[3px]"
        style={{
          zIndex: 20,
          background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))',
        }}
      />

      {/* ── Dark gradient vignette — bottom 64% for text legibility ──── */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          zIndex: 10,
          height: '64%',
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(8,3,6,0.68) 15%, rgba(5,1,4,0.88) 38%, rgba(4,1,3,0.96) 62%, rgba(4,1,3,1) 100%)',
        }}
      />

      {/* ── Spacer — lets top 36vh show the composition unobstructed ─── */}
      <div className="flex-1" style={{ minHeight: '36vh' }} />

      {/* ══════════════════════════════════════════════════════════════════
           INTERACTIVE OVERLAY — Tagline + Trust Badges + Buttons
           Anchored to the bottom of the viewport over the gradient.
      ══════════════════════════════════════════════════════════════════ */}
      <div className="relative flex flex-col items-center pb-10 lg:pb-16 px-8 text-center mx-auto w-full" style={{ zIndex: 20, maxWidth: 'min(92vw, 680px)' }}>

        {/* Tagline — fade-up with blur clear */}
        <motion.p
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.55, duration: 0.75 }}
          className="font-cormorant italic mb-4"
          style={{ fontSize: 'clamp(18px, 2vw, 26px)', color: 'rgba(255,248,234,0.70)', lineHeight: 1.5 }}
        >
          A journey through flavours of the world
        </motion.p>

        {/* Trust badges — stagger scale-in */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="flex items-center gap-2 mb-7 flex-wrap justify-center"
        >
          {['100% Veg', 'Jain Options', 'Fresh Daily'].map((badge, i) => (
            <motion.span
              key={badge}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.80 + i * 0.08, type: 'spring', stiffness: 300, damping: 14 }}
              className="font-inter text-[9px] lg:text-[10px] uppercase tracking-wide px-2.5 py-[3px] rounded-full"
              style={{
                background: 'rgba(217,160,58,0.12)',
                border: '1px solid rgba(217,160,58,0.40)',
                color: 'rgba(217,160,58,0.92)',
              }}
            >
              {badge}
            </motion.span>
          ))}
        </motion.div>

        {/* ── Premium animated buttons ─────────────────────────────── */}
        <div className="flex flex-col gap-3 w-full max-w-[268px] sm:max-w-[360px] lg:max-w-[420px]">
          <PrimaryBtn onClick={onOpenMenu}  delay={0.95} />
          <GoldBtn    onClick={onRecommend} delay={1.08} />
          <GhostBtn   onClick={onWaiter}    delay={1.20} />
        </div>
      </div>

      {/* ── Bottom gold accent bar ────────────────────────────────────── */}
      <div
        className="absolute bottom-0 inset-x-0 h-[3px]"
        style={{
          zIndex: 30,
          background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))',
        }}
      />

      {/* ── Corner ornaments ─────────────────────────────────────────── */}
      {(
        [
          { cls: 'top-6 left-6',    d: 'M0 24 L0 0 L24 0' },
          { cls: 'top-6 right-6',   d: 'M24 24 L24 0 L0 0' },
          { cls: 'bottom-6 left-6', d: 'M0 0 L0 24 L24 24' },
          { cls: 'bottom-6 right-6',d: 'M24 0 L24 24 L0 24' },
        ] as const
      ).map(({ cls, d }, i) => (
        <svg
          key={i}
          className={`absolute ${cls} pointer-events-none`}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ zIndex: 22, opacity: 0.42 }}
        >
          <path d={d} stroke="#D9A03A" strokeWidth="1.5" fill="none" />
        </svg>
      ))}
    </div>
  )
}
