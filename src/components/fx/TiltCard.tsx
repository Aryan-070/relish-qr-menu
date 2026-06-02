import { memo, useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'

interface TiltCardProps {
  children: ReactNode
  /** Maximum tilt in degrees. */
  max?: number
  className?: string
  style?: CSSProperties
}

/**
 * Spectacle-engine wrapper: a subtle 3D tilt that tracks the cursor across the
 * surface. Rotation is spring-smoothed motion values (no re-render). Settles
 * flat on leave; disabled under prefers-reduced-motion.
 */
function TiltCardBase({ children, max = 7, className, style }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 18 })
  const rY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 18 })

  const onMove = (e: React.PointerEvent) => {
    if (reduce) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const leave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={leave}
      className={className}
      style={{ perspective: 900, ...style }}
    >
      <motion.div style={{ rotateX: rX, rotateY: rY, transformStyle: 'preserve-3d' }}>
        {children}
      </motion.div>
    </div>
  )
}

export const TiltCard = memo(TiltCardBase)
