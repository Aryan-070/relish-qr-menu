import type { ReactNode } from 'react'

type BadgeVariant = 'jain' | 'price' | 'tag'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const styles: Record<BadgeVariant, string> = {
  jain: 'bg-olive/10 text-olive border border-olive/40 font-medium',
  price: 'bg-maroon/10 text-maroon border border-maroon/20 font-semibold',
  tag: 'bg-gold/10 text-gold border border-gold/30',
}

export function Badge({ children, variant = 'tag', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wide',
        'font-inter uppercase',
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
