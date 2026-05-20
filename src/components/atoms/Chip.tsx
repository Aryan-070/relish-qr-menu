import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Chip({ children, active = false, onClick, className = '' }: ChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={[
        'inline-flex items-center px-4 py-1.5 rounded-full border',
        'font-inter text-sm transition-all duration-200 select-none cursor-pointer whitespace-nowrap',
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
