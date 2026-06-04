import { useMemo, useRef } from 'react'
import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import * as THREE from 'three'
import { useTheme } from '../../../theme/ThemeContext'
import { OpenLetter, useOpenTransition } from './OpenLetter'

/**
 * QsrLandingParticles — full-screen brand hero for The Table Theory QSR café.
 *
 * 3D centrepiece: an ambient drifting particle field (soft sage/leaf motes
 * floating slowly upward, like gentle steam or falling leaves). Atmospheric,
 * quiet, editorial. Everything is offline & self-contained — no HDR, no
 * textures, no external assets.
 *
 * Reduced-motion: the <Canvas> is never mounted; a static CSS+SVG poster is
 * rendered instead, and the Framer text appears in its final state.
 */

const SAGE = '#8FB39A'
const TEAL = '#1E6E63'

// ---------------------------------------------------------------------------
// Particle layer
// ---------------------------------------------------------------------------

interface ParticleLayerProps {
  count: number
  color: string
  size: number
  opacity: number
  spread: number
  speed: number
  /** Phase offset so two layers bob out of sync. */
  phase: number
  /** When true, the field blooms — scales up, drifts faster, brightens briefly. */
  opening: boolean
}

/**
 * One drifting layer of motes. Positions live in a Float32Array; each frame we
 * nudge every point upward and wrap it back to the bottom once it clears the
 * top, giving an endless gentle rise. The whole group also bobs on a slow sine
 * and lerps toward the pointer for a soft parallax.
 */
function ParticleLayer({ count, color, size, opacity, spread, speed, phase, opening }: ParticleLayerProps) {
  const groupRef = useRef<THREE.Points>(null)
  // Smoothly-lerped 0→1 bloom factor; drives scale, drift speed, brightness.
  const burstRef = useRef(0)

  // Stable random cloud — generated once.
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * spread // x
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread // y
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread // z
    }
    return arr
  }, [count, spread])

  const halfSpread = spread / 2

  useFrame((state: RootState, delta: number) => {
    const group = groupRef.current
    if (!group) return

    // Ease the bloom factor toward its target (1 while opening, else 0). The
    // ~6/frame coefficient gives a ~0.4s rise — matching OpenLetter's flourish.
    const target = opening ? 1 : 0
    const burst = (burstRef.current += (target - burstRef.current) * Math.min(1, delta * 6))

    // Drift each mote upward; wrap around the top edge. Drift accelerates and
    // the spread widens (x/z pushed outward) as the field blooms.
    const geom = group.geometry
    const attr = geom.getAttribute('position') as THREE.BufferAttribute
    const array = attr.array as Float32Array
    const rise = speed * delta * (1 + burst * 3)
    const push = 1 + burst * delta * 1.6
    for (let i = 0; i < count; i++) {
      const xi = i * 3 + 0
      const yi = i * 3 + 1
      const zi = i * 3 + 2
      array[yi] += rise
      if (burst > 0.001) {
        array[xi] *= push
        array[zi] *= push
      }
      if (array[yi] > halfSpread) {
        array[yi] = -halfSpread
        array[xi] = (Math.random() - 0.5) * spread
      }
    }
    attr.needsUpdate = true

    // Gentle whole-field bob + pointer parallax. While blooming, the whole
    // group scales up toward ~1.6 for an outward accelerating rush.
    const t = state.clock.elapsedTime
    const scale = 1 + burst * 0.6
    group.scale.setScalar(scale)
    group.position.y = Math.sin(t * 0.15 + phase) * 0.12
    const targetX = state.pointer.y * 0.08
    const targetY = state.pointer.x * 0.12
    group.rotation.x += (targetX - group.rotation.x) * 0.04
    group.rotation.y += (targetY - group.rotation.y) * 0.04

    // Briefly brighten + enlarge the motes as they bloom.
    const mat = group.material as THREE.PointsMaterial
    mat.opacity = opacity + burst * (1 - opacity) * 0.8
    mat.size = size * (1 + burst * 0.6)
  })

  return (
    <Points ref={groupRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={color}
        size={size}
        sizeAttenuation
        depthWrite={false}
        opacity={opacity}
        blending={THREE.NormalBlending}
      />
    </Points>
  )
}

function ParticleScene({ opening }: { opening: boolean }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      {/* Foreground sage layer */}
      <ParticleLayer
        count={420}
        color={SAGE}
        size={0.07}
        opacity={0.7}
        spread={11}
        speed={0.22}
        phase={0}
        opening={opening}
      />
      {/* Faint teal depth layer */}
      <ParticleLayer
        count={180}
        color={TEAL}
        size={0.05}
        opacity={0.32}
        spread={14}
        speed={0.13}
        phase={Math.PI}
        opening={opening}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Static poster (reduced-motion fallback)
// ---------------------------------------------------------------------------

function StaticPoster({ bg }: { bg: string }) {
  // A handful of fixed motes — beautiful, zero motion.
  const dots = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        cx: (i * 137.5) % 100,
        cy: (i * 51.3) % 100,
        r: 0.5 + ((i * 7) % 5) * 0.4,
        fill: i % 4 === 0 ? TEAL : SAGE,
        o: 0.18 + ((i * 11) % 5) * 0.08,
      })),
    [],
  )
  return (
    <div
      className="absolute inset-0 z-0"
      aria-hidden="true"
      style={{
        background: `radial-gradient(120% 90% at 50% 110%, ${SAGE}55 0%, ${bg} 55%), linear-gradient(180deg, ${bg} 0%, ${SAGE}22 100%)`,
      }}
    >
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} opacity={d.o} />
        ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Foreground overlay
// ---------------------------------------------------------------------------

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

export function QsrLandingParticles({ onEnter }: { onEnter: () => void }) {
  const { tokens: t } = useTheme()
  const reduced = useReducedMotion()
  const { opening, begin } = useOpenTransition()

  // When reduced motion is requested, render everything in its final state.
  const animProps = reduced
    ? { initial: 'show' as const, animate: 'show' as const }
    : { initial: 'hidden' as const, animate: 'show' as const }

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: t.bg }}>
      {/* Background: live particles, or a static poster under reduced motion. */}
      {reduced ? (
        <StaticPoster bg={t.bg} />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 50 }}>
            <ParticleScene opening={opening} />
          </Canvas>
        </div>
      )}

      {/* Soft vignette to seat the text on the field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: `radial-gradient(80% 70% at 50% 45%, ${t.bg}00 0%, ${t.bg}66 78%, ${t.bg}cc 100%)`,
        }}
      />

      {/* Foreground content */}
      <motion.div
        variants={container}
        {...animProps}
        className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center"
      >
        <motion.p
          variants={rise}
          className="mb-5 text-[0.7rem] font-medium uppercase tracking-[0.32em] sm:text-xs"
          style={{ color: t.accent, fontFamily: t.descFont }}
        >
          The Table Theory · Est. 2026
        </motion.p>

        <motion.h1
          variants={rise}
          className="max-w-[16ch] font-semibold leading-[1.04] tracking-tight"
          style={{
            fontFamily: t.titleFont,
            color: t.ink,
            fontSize: 'clamp(2.6rem, 9vw, 6rem)',
          }}
        >
          Every Table Has{' '}
          <span style={{ color: t.accent, fontStyle: 'italic' }}>A Story.</span>
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-6 text-sm tracking-[0.18em] uppercase sm:text-base"
          style={{ color: TEAL, fontFamily: t.descFont }}
        >
          Food · Coffee · Conversations
        </motion.p>

        <motion.p
          variants={rise}
          className="mt-2 text-base italic sm:text-lg"
          style={{ color: t.ink, opacity: 0.7, fontFamily: t.titleFont }}
        >
          Sit Down. Open Up.
        </motion.p>

        <motion.button
          type="button"
          variants={rise}
          onClick={begin}
          disabled={opening}
          whileHover={reduced ? undefined : { scale: 1.04 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          className="mt-10 rounded-full px-9 py-3.5 text-sm font-semibold tracking-wide shadow-lg sm:text-base disabled:cursor-default disabled:opacity-80"
          style={{ background: t.accent, color: t.bg, fontFamily: t.descFont }}
        >
          Open Menu
        </motion.button>

        <motion.p
          variants={rise}
          className="mt-8 max-w-[40ch] text-xs leading-relaxed"
          style={{ color: t.ink, opacity: 0.5, fontFamily: t.descFont }}
        >
          A quiet café where every order opens an envelope — a little note,
          a small story, tucked alongside the food.
        </motion.p>
      </motion.div>

      {/* Shared cream "letter" that grows to fullscreen after the bloom, then
          hands off to the menu. Reduced-motion does a quick fade itself. */}
      <OpenLetter
        opening={opening}
        reduced={!!reduced}
        color={t.bg}
        inkColor={t.accent}
        font={t.headerFont ?? t.titleFont}
        onComplete={onEnter}
        flourishDelay={0.4}
      />
    </div>
  )
}

export default QsrLandingParticles
