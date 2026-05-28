import { motion } from 'framer-motion'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

const GREEN = '#2A4820'
const SAGE = '#6B8F5E'
const BG = '#F7FAF3'

function BotanicaBtn({
  onClick,
  children,
  variant = 'outline',
  fullWidth,
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'solid' | 'outline' | 'ghost'
  fullWidth?: boolean
}) {
  const cfg = {
    solid: {
      bg: GREEN,
      color: '#F7FAF3',
      border: `1.5px solid ${GREEN}`,
      hover: { background: '#1E3416' },
    },
    outline: {
      bg: 'transparent',
      color: SAGE,
      border: `1.5px solid ${SAGE}`,
      hover: { background: 'rgba(107,143,94,0.1)' },
    },
    ghost: {
      bg: 'transparent',
      color: 'rgba(42,72,32,0.5)',
      border: `1px solid rgba(42,72,32,0.22)`,
      hover: { background: 'rgba(42,72,32,0.06)' },
    },
  }
  const s = cfg[variant]
  return (
    <motion.button
      onClick={onClick}
      whileHover={s.hover}
      whileTap={{ scale: 0.96 }}
      className={`${fullWidth ? 'w-full' : 'flex-1'} py-3.5 rounded-full font-inter font-medium text-[12px] tracking-wide`}
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
        transition: 'background 0.2s',
      }}
    >
      {children}
    </motion.button>
  )
}

export function LandingBotanica({ onOpenMenu, onRecommend, onWaiter }: Props) {
  return (
    <div
      className="relative flex flex-col items-center min-h-dvh overflow-hidden"
      style={{ background: BG }}
    >
      {/* Botanical watermark — large herb illustration */}
      <svg
        className="absolute pointer-events-none"
        style={{ right: -30, top: '8%', width: 260, height: 380, opacity: 0.065, color: SAGE }}
        viewBox="0 0 260 380"
        fill="none"
      >
        {/* Main stem */}
        <path d="M 130 370 Q 125 300 130 220 Q 135 140 128 60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Large leaves — right */}
        <path d="M 130 280 Q 180 255 190 210 Q 165 240 130 250" fill="currentColor" opacity="0.85" />
        <path d="M 130 220 Q 195 195 200 145 Q 168 178 130 190" fill="currentColor" opacity="0.75" />
        <path d="M 130 160 Q 185 130 186 80 Q 158 118 130 132" fill="currentColor" opacity="0.65" />
        {/* Large leaves — left */}
        <path d="M 130 260 Q 75 238 68 192 Q 98 222 130 234" fill="currentColor" opacity="0.8" />
        <path d="M 130 198 Q 68 172 62 122 Q 96 158 130 172" fill="currentColor" opacity="0.7" />
        {/* Small sub-leaves */}
        <path d="M 130 310 Q 155 300 158 278 Q 142 292 130 295" fill="currentColor" opacity="0.6" />
        <path d="M 130 310 Q 106 298 102 276 Q 118 291 130 295" fill="currentColor" opacity="0.6" />
        {/* Tip sprigs */}
        <path d="M 128 60 Q 145 42 148 20 Q 134 38 128 52" fill="currentColor" opacity="0.55" />
        <path d="M 128 60 Q 110 40 108 18 Q 122 38 128 52" fill="currentColor" opacity="0.55" />
        {/* Decorative berries */}
        <circle cx="156" cy="95" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="164" cy="108" r="3" fill="currentColor" opacity="0.45" />
        <circle cx="98" cy="100" r="4" fill="currentColor" opacity="0.5" />
      </svg>

      {/* Left botanical accent */}
      <svg
        className="absolute pointer-events-none"
        style={{ left: -20, bottom: '15%', width: 160, height: 260, opacity: 0.055, color: GREEN }}
        viewBox="0 0 160 260"
        fill="none"
      >
        <path d="M 30 250 Q 35 190 40 130 Q 45 70 42 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M 40 180 Q 95 160 100 120 Q 72 148 40 158" fill="currentColor" />
        <path d="M 40 130 Q 88 108 90 68 Q 65 98 40 112" fill="currentColor" opacity="0.85" />
        <path d="M 40 190 Q 8 172 5 140 Q 25 162 40 170" fill="currentColor" opacity="0.75" />
        <circle cx="88" cy="74" r="3.5" fill="currentColor" opacity="0.6" />
        <circle cx="95" cy="86" r="2.5" fill="currentColor" opacity="0.5" />
      </svg>

      {/* Top sage accent bar */}
      <div className="absolute top-0 inset-x-0 h-[2.5px] z-10"
        style={{ background: `linear-gradient(to right, transparent, ${SAGE}, transparent)` }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full pt-10 pb-8 px-7">

        {/* Botanica plate — real food photo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center mb-5"
          style={{ width: 178, height: 178 }}
        >
          <img
            src="/assets/covers/cover-botanica-plate.webp"
            alt="Relish organic plate"
            style={{
              width: 178,
              height: 178,
              objectFit: 'cover',
              borderRadius: '50%',
              boxShadow: '0 8px 24px rgba(42,72,32,0.18)',
            }}
          />
        </motion.div>

        {/* Growing leaf ornaments */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 mb-3"
        >
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <path d="M 28 7 Q 18 0 8 3 Q 14 7 14 7 Q 14 7 8 11 Q 18 14 28 7 Z" fill={SAGE} opacity="0.7" />
          </svg>
          <span style={{ color: SAGE, fontSize: 8 }}>✿</span>
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ transform: 'scaleX(-1)' }}>
            <path d="M 28 7 Q 18 0 8 3 Q 14 7 14 7 Q 14 7 8 11 Q 18 14 28 7 Z" fill={SAGE} opacity="0.7" />
          </svg>
        </motion.div>

        {/* RELISH wordmark */}
        <motion.h1
          className="font-playfair font-bold text-center mb-1"
          style={{ fontSize: 68, color: GREEN, letterSpacing: '0.06em', lineHeight: 0.95 }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          RELISH
        </motion.h1>

        {/* Animated sage underline */}
        <svg width="200" height="6" viewBox="0 0 200 6" style={{ marginBottom: 4 }}>
          <motion.line
            x1="0"
            y1="3"
            x2="200"
            y2="3"
            stroke={SAGE}
            strokeWidth="1.2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.9, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="font-inter uppercase text-[9.5px] tracking-[0.22em] mb-4"
          style={{ color: SAGE }}
        >
          International Veg Cuisine
        </motion.p>

        {/* Caveat handwritten tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.6 }}
          className="font-caveat text-center mb-6"
          style={{ fontSize: 20, color: `rgba(42,72,32,0.7)`, lineHeight: 1.4 }}
        >
          Farm fresh · seasonal · crafted with love
        </motion.p>

        {/* Trust badges — botanical style */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.18, duration: 0.5 }}
          className="flex items-center gap-3 mb-7 flex-wrap justify-center"
        >
          {[
            { icon: '🌿', text: '100% Veg' },
            { icon: '✦', text: 'Jain Options' },
            { icon: '🌱', text: 'Fresh Daily' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <span style={{ fontSize: 11 }}>{icon}</span>
              <span
                className="font-inter text-[10px] uppercase tracking-wide"
                style={{ color: `rgba(42,72,32,0.65)` }}
              >
                {text}
              </span>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.32, duration: 0.5 }}
          className="flex flex-col gap-2.5 w-full max-w-[280px]"
        >
          <BotanicaBtn onClick={onOpenMenu} variant="solid" fullWidth>
            Open Menu
          </BotanicaBtn>
          <BotanicaBtn onClick={onRecommend} variant="outline" fullWidth>
            ✦ Recommend Something
          </BotanicaBtn>
          <BotanicaBtn onClick={onWaiter} variant="ghost" fullWidth>
            Call Waiter
          </BotanicaBtn>
        </motion.div>

        {/* Bottom botanical bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="mt-auto pt-8 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-3">
            <div style={{ width: 40, height: 1, background: `rgba(107,143,94,0.4)` }} />
            <span style={{ color: SAGE, fontSize: 9 }}>✿</span>
            <span
              className="font-inter text-[8px] uppercase tracking-[0.2em]"
              style={{ color: `rgba(107,143,94,0.7)` }}
            >
              Farm to Table
            </span>
            <span style={{ color: SAGE, fontSize: 9 }}>✿</span>
            <div style={{ width: 40, height: 1, background: `rgba(107,143,94,0.4)` }} />
          </div>
        </motion.div>
      </div>

      {/* Bottom sage bar */}
      <div
        className="absolute bottom-0 inset-x-0 h-[2.5px] z-10"
        style={{ background: `linear-gradient(to right, transparent, ${SAGE}, transparent)` }}
      />
    </div>
  )
}
