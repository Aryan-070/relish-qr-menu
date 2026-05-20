import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'gold' | 'ghost' | 'maroon'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  onClick?: () => void
  className?: string
  fullWidth?: boolean
  disabled?: boolean
}

const styles: Record<Variant, string> = {
  primary: 'bg-maroon text-white border-maroon hover:bg-[#6d0d1c]',
  gold: 'bg-gold text-white border-gold hover:bg-[#c08d2e]',
  ghost: 'bg-transparent text-maroon border-maroon hover:bg-maroon/8',
  maroon: 'bg-maroon/10 text-maroon border-maroon/30 hover:bg-maroon/18',
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  className = '',
  fullWidth = false,
  disabled = false,
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={disabled ? undefined : onClick}
      className={[
        'inline-flex items-center justify-center gap-2',
        'px-5 py-2.5 rounded-full border',
        'font-inter font-medium text-sm tracking-wide',
        'transition-colors duration-150',
        'select-none cursor-pointer',
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </motion.button>
  )
}
