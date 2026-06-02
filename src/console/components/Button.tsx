import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'
import { cn } from '../lib/format'
import { btnPrimary } from '../../animations/variants'

type Variant = 'primary' | 'gold' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  onClick?: () => void
  type?: 'button' | 'submit'
  fullWidth?: boolean
  disabled?: boolean
  className?: string
  title?: string
  'aria-label'?: string
}

/** Console button — denser superset of the guest Button with size + danger. */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  type = 'button',
  fullWidth = false,
  disabled = false,
  className = '',
  title,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.accent, fg: '#fff', border: t.accent },
    gold: { bg: '#D9A03A', fg: '#3a2a08', border: '#D9A03A' },
    ghost: { bg: 'transparent', fg: t.accent, border: t.accent },
    subtle: { bg: 'rgba(42,30,30,0.05)', fg: t.ink, border: 'rgba(42,30,30,0.12)' },
    danger: { bg: 'rgba(215,25,32,0.10)', fg: '#b3141b', border: 'rgba(215,25,32,0.4)' },
  }
  const p = palette[variant]
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-[12px] min-h-[34px]' : 'px-4 py-2.5 text-[13px] min-h-[44px]'

  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : btnPrimary.tap}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold select-none transition-colors cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        sizing,
        fullWidth && 'w-full',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
      style={{
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: hard ? 0 : 999,
        fontFamily: t.descFont,
        textTransform: hard ? 'uppercase' : 'none',
        letterSpacing: hard ? '0.04em' : 0,
        outlineColor: t.accent,
      }}
    >
      {children}
    </motion.button>
  )
}
