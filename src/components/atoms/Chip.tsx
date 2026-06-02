import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'

interface ChipProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Chip({ children, active = false, onClick, className = '' }: ChipProps) {
  const { tokens: t } = useTheme()
  const hard = t.navStyle === 'underline'
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{
        borderRadius: hard ? 0 : 9999,
        fontFamily: hard ? t.descFont : 'Inter, sans-serif',
        textTransform: hard ? 'uppercase' : 'none',
        letterSpacing: hard ? '0.04em' : 'normal',
        minHeight: 44,
      }}
      className={[
        'inline-flex items-center px-4 py-1.5 border',
        'text-sm transition-all duration-200 select-none cursor-pointer whitespace-nowrap',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-maroon',
        active
          ? 'bg-maroon text-white border-maroon'
          : 'bg-paper text-ink-soft border-mute/60 hover:border-maroon/40 hover:text-maroon',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </motion.button>
  )
}
