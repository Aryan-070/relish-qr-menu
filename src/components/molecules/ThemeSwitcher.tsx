import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { THEME_ORDER, THEMES } from '../../theme/themes'
import { useComponentStyle, COMPONENT_STYLES } from '../../theme/ComponentStyleContext'

type ScreenKind = 'cover' | 'menu' | 'recommend'

interface ThemeSwitcherProps {
  /** Current screen — used to anchor the gear where it never overlaps nav/CTAs. */
  screen?: ScreenKind
}

/**
 * Floating UI-theme switcher — a discreet gear that expands into the
 * Warm / Hybrid / Brutal picker. Collapsed by default so it never blocks
 * the bottom nav or CTAs; still lets us compare the three themes live.
 *
 * Anchored per-screen:
 *  - cover     → bottom-left (variant pills live top-right)
 *  - menu      → lifted clear ABOVE the BottomNav, bottom-right
 *  - recommend → bottom-left (back button is top-left)
 */
export function ThemeSwitcher({ screen = 'menu' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()
  const { style: engine, setStyle } = useComponentStyle()
  const [open, setOpen] = useState(false)

  // Safe anchor per screen so the collapsed gear never sits in a tappable band.
  const anchor: React.CSSProperties =
    screen === 'menu'
      ? { right: 12, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)' }
      : screen === 'recommend'
        ? { right: 12, bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' } // lift above the full-width Next CTA
        : { left: 12, bottom: 12 } // cover

  const openLeft = anchor.left !== undefined

  return (
    <>
      {/* Tap-scrim to dismiss when expanded */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close theme picker"
            className="fixed inset-0 z-[69]"
            style={{ background: 'transparent' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="absolute z-[70] flex items-center gap-2" style={anchor}>
        {/* Gear / close toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close theme picker' : 'Open theme picker'}
          aria-expanded={open}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            order: openLeft ? 0 : 2,
            background: open ? 'rgba(139,16,36,0.92)' : 'rgba(255,255,255,0.78)',
            border: open ? '1px solid #8B1024' : '1px solid rgba(0,0,0,0.12)',
            color: open ? '#FFF8EA' : 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
          }}
        >
          {open ? <X size={16} strokeWidth={2.4} /> : <SlidersHorizontal size={16} strokeWidth={2.2} />}
        </motion.button>

        {/* Expanding pills */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="theme-pills"
              initial={{ opacity: 0, scale: 0.9, x: openLeft ? -8 : 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: openLeft ? -8 : 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="flex flex-col gap-1.5 rounded-2xl p-2"
              style={{
                order: 1,
                maxWidth: 188,
                background: 'rgba(252,250,245,0.95)',
                border: '1px solid rgba(0,0,0,0.08)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                boxShadow: '0 6px 22px rgba(0,0,0,0.16)',
              }}
            >
              {/* Row 1 — colour theme */}
              <PillRow label="UI">
                {THEME_ORDER.map(t => (
                  <Pill key={t} active={theme === t} onClick={() => setTheme(t)} ariaLabel={`${THEMES[t].label} theme`}>
                    {THEMES[t].label}
                  </Pill>
                ))}
              </PillRow>
              {/* Row 2 — component engine (classic / motion / spectacle) */}
              <PillRow label="FX">
                {COMPONENT_STYLES.map(s => (
                  <Pill key={s.id} active={engine === s.id} onClick={() => setStyle(s.id)} ariaLabel={`${s.label} components`}>
                    {s.label}
                  </Pill>
                ))}
              </PillRow>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

function PillRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span
        className="font-inter uppercase mr-0.5 w-4 shrink-0"
        style={{ fontSize: 7, letterSpacing: '0.16em', color: 'rgba(0,0,0,0.4)' }}
        aria-hidden
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function Pill({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="px-2.5 py-1 rounded-full font-inter uppercase tracking-widest"
      style={{
        fontSize: 8,
        minHeight: 28,
        background: active ? 'rgba(139,16,36,0.92)' : 'rgba(255,255,255,0.82)',
        border: active ? '1px solid #8B1024' : '1px solid rgba(0,0,0,0.12)',
        color: active ? '#FFF8EA' : 'rgba(0,0,0,0.55)',
        boxShadow: active ? '0 2px 8px rgba(139,16,36,0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </motion.button>
  )
}
