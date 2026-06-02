import { motion, type TargetAndTransition } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { useComponentStyle } from '../../theme/ComponentStyleContext'
import { MagneticButton } from '../fx/MagneticButton'
import { BorderBeam } from '../fx/BorderBeam'

type Variant = 'primary' | 'gold' | 'ghost' | 'maroon'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  onClick?: () => void
  className?: string
  fullWidth?: boolean
  disabled?: boolean
}

/** #RRGGBB → rgba() with the given alpha. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  className = '',
  fullWidth = false,
  disabled = false,
}: ButtonProps) {
  const { tokens: t } = useTheme()
  const { style: engine } = useComponentStyle()
  const hard = t.navStyle === 'underline'

  // Colours derive from the active theme so `primary` is terracotta in the
  // editorial skin and maroon elsewhere — no per-theme button code needed.
  const isFilled = variant === 'primary' || variant === 'gold'
  const isGhost = variant === 'ghost'
  const filledBg = variant === 'gold' ? '#D9A03A' : t.accent

  let colors: CSSProperties
  let hoverFx: TargetAndTransition
  if (isFilled) {
    colors = { background: filledBg, color: '#FFF8EA', borderColor: filledBg }
    hoverFx = { filter: 'brightness(0.93)' }
  } else if (isGhost) {
    colors = { background: 'transparent', color: t.accent, borderColor: t.accent }
    hoverFx = { backgroundColor: hexA(t.accent, 0.08) }
  } else {
    colors = { background: hexA(t.accent, 0.1), color: t.accent, borderColor: hexA(t.accent, 0.3) }
    hoverFx = { backgroundColor: hexA(t.accent, 0.18) }
  }

  const spring = { type: 'spring' as const, stiffness: 320, damping: 22 }
  const whileHover = disabled
    ? undefined
    : engine === 'classic'
      ? hoverFx
      : { ...hoverFx, scale: 1.015, y: -1 }
  const whileTap = disabled
    ? undefined
    : engine === 'classic'
      ? { scale: 0.95 }
      : { scale: 0.955, y: 2 }

  // Border-beam treatment on filled CTAs in the livelier engines (classic stays calm).
  const showBeam = isFilled && engine !== 'classic' && !disabled

  const btn = (
    <motion.button
      whileHover={whileHover}
      whileTap={whileTap}
      transition={engine === 'classic' ? undefined : spring}
      onClick={disabled ? undefined : onClick}
      style={{
        ...colors,
        position: 'relative',
        borderRadius: hard ? 0 : 9999,
        fontFamily: hard ? t.descFont : t.pill.font,
        textTransform: hard ? 'uppercase' : 'none',
        letterSpacing: hard ? '0.04em' : '0.02em',
        minHeight: 44,
      }}
      className={[
        'inline-flex items-center justify-center gap-2',
        'px-5 py-3 border',
        'font-medium text-sm',
        'select-none cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon',
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showBeam && <BorderBeam color="rgba(255,255,255,0.7)" duration={hard ? 5 : 4} />}
      {children}
    </motion.button>
  )

  // Spectacle engine: magnetically pull the button toward the cursor.
  if (engine === 'spectacle' && !disabled) {
    return <MagneticButton className={fullWidth ? 'w-full' : ''}>{btn}</MagneticButton>
  }
  return btn
}
