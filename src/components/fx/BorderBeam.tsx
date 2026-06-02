import { memo } from 'react'

interface BorderBeamProps {
  /** Beam colour (defaults to a soft white highlight for filled buttons). */
  color?: string
  /** Seconds per revolution. */
  duration?: number
  /** Beam thickness in px. */
  size?: number
}

/**
 * A light that travels around the border of its (position:relative) parent —
 * the 2026 "border-beam" CTA treatment. Pure CSS: a rotating conic-gradient
 * masked to a thin ring via the app's existing `--conic-angle` @property +
 * `conic-spin` keyframe (src/index.css). Themed by `color`, pointer-events:none,
 * radius inherited from the parent so it follows pill/square shapes.
 */
function BorderBeamBase({ color = 'rgba(255,255,255,0.85)', duration = 4, size = 1.5 }: BorderBeamProps) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        padding: size,
        background: `conic-gradient(from var(--conic-angle), transparent 0%, ${color} 12%, transparent 28%)`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        animation: `conic-spin ${duration}s linear infinite`,
        pointerEvents: 'none',
      }}
    />
  )
}

export const BorderBeam = memo(BorderBeamBase)
