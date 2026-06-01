import { motion } from 'framer-motion'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

const DECO_GOLD = '#B8920A'
const DECO_INK = '#1A1208'
const DECO_BG = '#FDF6E3'
const DECO_MAROON = '#7A1020'

function DecoRule({ thick, color = DECO_INK }: { thick?: boolean; color?: string }) {
  return (
    <div
      style={{
        height: thick ? 3 : 1,
        background: color,
        width: '100%',
      }}
    />
  )
}

function ThickThinRule() {
  return (
    <div className="flex flex-col gap-[3px] w-full">
      <DecoRule thick />
      <DecoRule color={`rgba(26,18,8,0.4)`} />
    </div>
  )
}

function DecoBtn({
  onClick,
  children,
  primary,
  fullWidth,
}: {
  onClick: () => void
  children: React.ReactNode
  primary?: boolean
  fullWidth?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{
        background: primary ? '#9A7208' : `rgba(184,146,10,0.1)`,
        color: primary ? DECO_BG : DECO_GOLD,
      }}
      whileTap={{ scale: 0.97 }}
      className={`${fullWidth ? 'w-full' : 'flex-1'} py-3.5 font-inter font-semibold uppercase text-[11px] lg:text-[13px] tracking-[0.18em]`}
      style={{
        background: primary ? DECO_GOLD : 'transparent',
        color: primary ? DECO_BG : DECO_GOLD,
        border: `1.5px solid ${DECO_GOLD}`,
        borderRadius: 1,
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      {children}
    </motion.button>
  )
}

export function LandingGastronomique({ onOpenMenu, onRecommend, onWaiter }: Props) {
  return (
    <div
      className="relative flex flex-col min-h-full overflow-hidden"
      style={{ background: DECO_BG }}
    >
      {/* Background oversized "R" monogram */}
      <div
        className="absolute pointer-events-none select-none"
        style={{ right: -20, bottom: 40, zIndex: 0, opacity: 0.045 }}
      >
        <span
          className="font-playfair font-bold"
          style={{
            fontSize: 340,
            color: DECO_GOLD,
            lineHeight: 1,
            display: 'block',
            userSelect: 'none',
          }}
        >
          R
        </span>
      </div>

      {/* Art Deco geometric frame lines (animated draw) */}
      <motion.svg
        className="absolute pointer-events-none"
        style={{ inset: 12, zIndex: 1 }}
        viewBox="0 0 406 776"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer rectangle */}
        <motion.rect
          x="1"
          y="1"
          width="404"
          height="774"
          stroke={DECO_GOLD}
          strokeWidth="0.8"
          opacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Inner rectangle */}
        <motion.rect
          x="9"
          y="9"
          width="388"
          height="758"
          stroke={DECO_GOLD}
          strokeWidth="0.4"
          opacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.6, duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Corner diamond TL */}
        <motion.path
          d="M 1 36 L 36 1"
          stroke={DECO_GOLD}
          strokeWidth="0.7"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.8, duration: 0.35 }}
        />
        {/* Corner diamond TR */}
        <motion.path
          d="M 370 1 L 405 36"
          stroke={DECO_GOLD}
          strokeWidth="0.7"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.9, duration: 0.35 }}
        />
        {/* Corner diamond BL */}
        <motion.path
          d="M 1 740 L 36 775"
          stroke={DECO_GOLD}
          strokeWidth="0.7"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 2.0, duration: 0.35 }}
        />
        {/* Corner diamond BR */}
        <motion.path
          d="M 370 775 L 405 740"
          stroke={DECO_GOLD}
          strokeWidth="0.7"
          opacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 2.1, duration: 0.35 }}
        />
      </motion.svg>

      <div
        className="relative z-10 flex flex-col flex-1 justify-between gap-[clamp(4px,1.2vh,18px)] px-6 mx-auto w-full"
        style={{ width: '100%', maxWidth: 'min(94vw, 940px)' }}
      >
        {/* Top thick-thin rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'left' }}
          className="mt-5 lg:mt-8"
        >
          <ThickThinRule />
        </motion.div>

        {/* Masthead */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex items-center justify-between py-2"
        >
          <span
            className="font-inter text-[8px] uppercase tracking-[0.24em]"
            style={{ color: DECO_INK, opacity: 0.65 }}
          >
            Est. 2024
          </span>
          <span
            className="font-inter text-[8px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: DECO_INK }}
          >
            Fine Dining · Vol. I
          </span>
          <span
            className="font-inter text-[8px] uppercase tracking-[0.24em]"
            style={{ color: DECO_INK, opacity: 0.65 }}
          >
            Anno 2024
          </span>
        </motion.div>

        <DecoRule thick />

        {/* Food portrait placeholder — cinematic amber sepia */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden mt-4"
          style={{ height: 'min(clamp(178px, 26vw, 340px), 25vh)', borderRadius: 0, border: `1px solid rgba(184,146,10,0.35)` }}
        >
          {/* Sepia-amber gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(150deg, #1A0C04 0%, #4A2208 30%, #9A5A10 58%, #D4A040 82%, #F0D880 100%)',
            }}
          />
          {/* Bokeh layers */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              inset: 0,
              background: 'radial-gradient(ellipse at 40% 60%, rgba(240,180,55,0.5) 0%, transparent 55%)',
            }}
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute pointer-events-none"
            style={{
              inset: 0,
              background: 'radial-gradient(ellipse at 70% 30%, rgba(122,16,32,0.45) 0%, transparent 48%)',
            }}
            animate={{ opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 7, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Deco portrait food photo — centred over bokeh */}
          <img
            src="/assets/covers/cover-deco-portrait.webp"
            alt="Relish fine dining"
            className="absolute object-cover"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '100%',
              opacity: 0.92,
            }}
          />

          {/* Art Deco ornament overlay */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-2 flex items-center justify-center gap-3"
            style={{ background: 'linear-gradient(to top, rgba(20,8,2,0.75) 0%, transparent 100%)' }}>
            <div style={{ flex: 1, height: 1, background: `rgba(200,168,48,0.5)` }} />
            <span className="font-inter text-[8px] uppercase tracking-[0.28em]" style={{ color: 'rgba(220,185,80,0.85)', whiteSpace: 'nowrap' }}>
              Chef's Signature
            </span>
            <div style={{ flex: 1, height: 1, background: `rgba(200,168,48,0.5)` }} />
          </div>
        </motion.div>

        <DecoRule color={`rgba(26,18,8,0.3)`} />

        {/* Diamond ornament + "R" block */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.55 }}
          className="flex items-center gap-3 py-3"
        >
          <div style={{ flex: 1, height: 1, background: DECO_GOLD }} />
          <span style={{ color: DECO_GOLD, fontSize: 10 }}>◆</span>
          <div style={{ flex: 1, height: 1, background: DECO_GOLD }} />
        </motion.div>

        {/* Main wordmark */}
        <motion.div
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          transition={{ delay: 0.72, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <h1
            className="font-playfair font-bold text-center w-full"
            style={{
              fontSize: 'clamp(58px, 12.5vw, 150px)',
              color: DECO_MAROON,
              letterSpacing: '0.08em',
              lineHeight: 0.9,
            }}
          >
            RELISH
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.28, duration: 0.5 }}
          className="flex flex-col items-center gap-1.5 mb-1 mt-2"
        >
          <div className="flex items-center gap-3 w-full">
            <div style={{ flex: 1, height: 1, background: `rgba(26,18,8,0.25)` }} />
            <span
              className="font-inter text-[9.5px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: DECO_GOLD, whiteSpace: 'nowrap' }}
            >
              International Veg Cuisine
            </span>
            <div style={{ flex: 1, height: 1, background: `rgba(26,18,8,0.25)` }} />
          </div>

          <p
            className="font-cormorant italic text-center"
            style={{ fontSize: 14, color: `rgba(26,18,8,0.55)`, lineHeight: 1.5 }}
          >
            Where each plate tells a story of craft and culture
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.38, duration: 0.45 }}
          className="flex items-center gap-3 py-3"
        >
          <div style={{ flex: 1, height: 1, background: DECO_GOLD }} />
          <span style={{ color: DECO_GOLD, fontSize: 10 }}>◆</span>
          <div style={{ flex: 1, height: 1, background: DECO_GOLD }} />
        </motion.div>

        <DecoRule thick />

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="flex flex-col gap-2.5 py-3"
        >
          <div className="flex gap-2.5">
            <DecoBtn onClick={onOpenMenu} primary>
              Open Menu
            </DecoBtn>
            <DecoBtn onClick={onRecommend}>
              ✦ Recommend
            </DecoBtn>
          </div>
          <DecoBtn onClick={onWaiter} fullWidth>
            Call Waiter
          </DecoBtn>
        </motion.div>

        {/* Bottom masthead */}
        <div className="mt-6">
          <ThickThinRule />
          <div className="flex justify-center pt-2">
            <span
              className="font-inter text-[7.5px] uppercase tracking-[0.26em] text-center"
              style={{ color: `rgba(26,18,8,0.5)` }}
            >
              International Veg Cuisine &nbsp;·&nbsp; Est. 2024 &nbsp;·&nbsp; Crafted With Care
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
