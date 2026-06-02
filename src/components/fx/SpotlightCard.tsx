import { memo, useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from 'framer-motion'

interface SpotlightCardProps {
  children: ReactNode
  /** Spotlight tint (rgba). Defaults to a soft terracotta. */
  color?: string
  radius?: number
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

/**
 * Spectacle-engine wrapper: a cursor-tracked radial highlight rides over the
 * surface. The gradient position is a motion value (no re-render), and the
 * overlay is pointer-events:none so it never intercepts taps.
 */
function SpotlightCardBase({
  children,
  color = 'rgba(184,92,68,0.16)',
  radius = 180,
  className,
  style,
  onClick,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const mx = useMotionValue(-9999)
  const my = useMotionValue(-9999)
  const bg = useMotionTemplate`radial-gradient(${radius}px circle at ${mx}px ${my}px, ${color}, transparent 72%)`

  const onMove = (e: React.PointerEvent) => {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    mx.set(e.clientX - r.left)
    my.set(e.clientY - r.top)
  }
  const leave = () => {
    mx.set(-9999)
    my.set(-9999)
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={leave}
      onClick={onClick}
      className={className}
      style={{ position: 'relative', ...style }}
    >
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: bg,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {children}
    </div>
  )
}

export const SpotlightCard = memo(SpotlightCardBase)
