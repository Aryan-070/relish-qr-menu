import { motion } from 'framer-motion'

interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}

interface EBtnProps {
  onClick: () => void
  children: React.ReactNode
  filled?: boolean
  outlined?: boolean
  ghost?: boolean
  fullWidth?: boolean
}

function EditorialBtn({ onClick, children, filled, outlined, ghost, fullWidth }: EBtnProps) {
  const borderColor = ghost ? 'rgba(139,16,36,0.4)' : '#8B1024'
  const textColor = ghost ? 'rgba(139,16,36,0.55)' : filled ? '#FFF8EA' : '#8B1024'
  const bgColor = filled ? '#8B1024' : 'transparent'
  return (
    <motion.button
      onClick={onClick}
      whileHover={{
        scale: 1.015,
        background: filled ? '#6E0C1B' : outlined ? '#8B1024' : ghost ? 'rgba(139,16,36,0.06)' : 'transparent',
        color: outlined ? '#FFF8EA' : undefined,
      }}
      whileTap={{ scale: 0.97 }}
      className={`${fullWidth ? 'w-full' : 'flex-1'} py-3.5 font-inter font-semibold uppercase text-[11px] tracking-[0.16em]`}
      style={{
        background: bgColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 0,
        transition: 'background 0.18s, color 0.18s',
      }}
    >
      {children}
    </motion.button>
  )
}

function Rule({ thick, mx }: { thick?: boolean; mx?: boolean }) {
  return (
    <div
      style={{
        height: thick ? 3 : 1,
        background: '#2A1E1E',
        marginLeft: mx ? 16 : 0,
        marginRight: mx ? 16 : 0,
      }}
    />
  )
}

export function LandingEditorial({ onOpenMenu, onRecommend, onWaiter }: Props) {
  return (
    <div
      className="relative flex flex-col min-h-dvh overflow-hidden"
      style={{ background: 'var(--paper)' }}
    >
      {/* Top thick rule */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        style={{ transformOrigin: 'left', height: 3, background: '#2A1E1E' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Masthead bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="flex items-center justify-between px-4 py-1.5"
        style={{ borderBottom: '1px solid rgba(42,30,30,0.5)' }}
      >
        <span className="font-inter text-[8.5px] uppercase tracking-[0.2em]" style={{ color: '#2A1E1E' }}>
          Est. 2024
        </span>
        <span className="font-inter text-[8.5px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#2A1E1E' }}>
          Relish Dining
        </span>
        <span className="font-inter text-[8.5px] uppercase tracking-[0.2em]" style={{ color: '#2A1E1E' }}>
          Vol. I
        </span>
      </motion.div>

      {/* Main headline — clip wipe reveal */}
      <motion.div
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ delay: 0.45, duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center pt-6 pb-4 px-4"
      >
        <h1
          className="font-playfair font-bold text-center w-full"
          style={{
            fontSize: 90,
            color: 'var(--maroon)',
            letterSpacing: '-0.02em',
            lineHeight: 0.87,
          }}
        >
          RELISH
        </h1>

        {/* Gold underline draw */}
        <svg width="210" height="5" viewBox="0 0 210 5" className="mt-2.5">
          <motion.line
            x1="0"
            y1="2.5"
            x2="210"
            y2="2.5"
            stroke="#D9A03A"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.25, duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </motion.div>

      {/* Editorial food spread — full-width hero strip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.85, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden"
      >
        <img
          src="/assets/covers/cover-editorial-spread.webp"
          alt="Relish editorial food spread"
          className="w-full aspect-[21/9] object-cover"
          style={{
            borderTop: '1px solid rgba(42,30,30,0.15)',
            borderBottom: '1px solid rgba(42,30,30,0.15)',
          }}
        />
      </motion.div>

      <Rule />

      {/* Feature section — two columns */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.55 }}
        className="flex gap-0 px-4 py-4"
      >
        {/* Left col — editorial tagline */}
        <div className="flex-1 pr-4" style={{ borderRight: '1px solid rgba(42,30,30,0.2)' }}>
          <p
            className="font-cormorant italic"
            style={{ fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.38 }}
          >
            A Journey Through The World's Finest Vegetarian Cuisine
          </p>
          <p
            className="font-inter text-[10.5px] mt-2.5 leading-relaxed"
            style={{ color: 'var(--mute)' }}
          >
            Five categories. Sixty dishes crafted with care. One unforgettable dining experience.
          </p>
        </div>

        {/* Right col — facts */}
        <div className="pl-4 flex flex-col gap-2 justify-center shrink-0">
          {['100% Veg', 'Jain Options', 'Fresh Daily', 'Curated Pairings'].map((fact) => (
            <div key={fact} className="flex items-center gap-1.5">
              <span style={{ color: 'var(--gold)', fontSize: 7 }}>✦</span>
              <span
                className="font-inter text-[9.5px] uppercase tracking-wide"
                style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}
              >
                {fact}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <Rule />

      {/* Pull quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.35, duration: 0.5 }}
        className="px-4 py-4 flex items-start gap-3"
        style={{ borderBottom: '1px solid rgba(42,30,30,0.25)' }}
      >
        <span
          className="font-playfair font-bold shrink-0"
          style={{ fontSize: 52, color: 'var(--gold)', lineHeight: 0.7, marginTop: 4 }}
        >
          "
        </span>
        <p
          className="font-cormorant italic"
          style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}
        >
          Where every plate tells a story of culture, craft, and pure vegetarian joy.
        </p>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="flex flex-col gap-3 px-4 py-5"
      >
        <div className="flex gap-2">
          <EditorialBtn onClick={onOpenMenu} filled>
            Open Menu
          </EditorialBtn>
          <EditorialBtn onClick={onRecommend} outlined>
            ✦ Recommend
          </EditorialBtn>
        </div>
        <EditorialBtn onClick={onWaiter} ghost fullWidth>
          Call Waiter
        </EditorialBtn>
      </motion.div>

      {/* Bottom masthead */}
      <div className="mt-auto">
        <Rule />
        <div
          className="py-2 px-4 flex justify-center"
          style={{ borderBottom: '3px solid #2A1E1E' }}
        >
          <span
            className="font-inter text-[8px] uppercase tracking-[0.22em] text-center"
            style={{ color: '#2A1E1E' }}
          >
            International Veg Cuisine &nbsp;•&nbsp; Scan to Browse &nbsp;•&nbsp; Est. 2024
          </span>
        </div>
      </div>

      {/* Side ornaments */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: 0.06 }}
      >
        <svg width="14" height="120" viewBox="0 0 14 120" fill="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x="5" y={6 + i * 22} width="4" height="14" fill="#2A1E1E" />
          ))}
        </svg>
      </div>
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: 0.06 }}
      >
        <svg width="14" height="120" viewBox="0 0 14 120" fill="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x="5" y={6 + i * 22} width="4" height="14" fill="#2A1E1E" />
          ))}
        </svg>
      </div>
    </div>
  )
}
