import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, RoundedBox } from '@react-three/drei'
import { motion, useReducedMotion } from 'framer-motion'
import * as THREE from 'three'
import { useTheme } from '../../../theme/ThemeContext'
import { OpenLetter, useOpenTransition } from './OpenLetter'

/**
 * QsrLandingEnvelope — a quiet, brand-on hero for The Table Theory QSR cafe.
 *
 * The 3D centrepiece is a slowly floating wax-sealed envelope (the brand's
 * signature ritual). It is built entirely from primitives — no HDR, no presets,
 * no external textures or models — so it runs fully offline.
 *
 * If the user prefers reduced motion, the <Canvas> is never mounted; a static
 * CSS + inline-SVG poster is rendered instead, and the Framer entrance is shown
 * in its final (settled) state.
 */
export function QsrLandingEnvelope({ onEnter }: { onEnter: () => void }) {
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const { opening, begin } = useOpenTransition()

  // Brand wax-seal tone: a warm forest-leaning terracotta.
  const wax = '#A24B36'
  const teal = '#1E6E63'
  const paper = '#EFE7D6' // body — a touch lighter than the cream bg
  const flapPaper = '#E2D6BE' // flap — a slightly darker cream

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* 3D scene (or static poster under reduced motion) — behind the text. */}
      <div
        className="absolute inset-0 z-0"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        {reduce ? (
          <StaticPoster bg={t.bg} accent={t.accent} sage={t.accent2} wax={wax} />
        ) : (
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 45 }}>
            <Scene
              accent={t.accent}
              paper={paper}
              flapPaper={flapPaper}
              wax={wax}
              sage={t.accent2}
              opening={opening}
            />
          </Canvas>
        )}
      </div>

      {/* Foreground overlay — centered content. */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
        <Overlay
          reduce={!!reduce}
          onEnter={begin}
          opening={opening}
          accent={t.accent}
          teal={teal}
          ink={t.ink}
          titleFont={t.titleFont}
          descFont={t.descFont}
        />
      </div>

      {/* Shared cream "letter" that grows to fullscreen, then hands off to the
          menu. Plays after the 3D flap-open flourish (≈0.45s). */}
      <OpenLetter
        opening={opening}
        reduced={!!reduce}
        color={t.bg}
        inkColor={t.accent}
        font={t.headerFont ?? t.titleFont}
        onComplete={onEnter}
        flourishDelay={0.45}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Foreground content                                                  */
/* ------------------------------------------------------------------ */

interface OverlayProps {
  reduce: boolean
  onEnter: () => void
  opening: boolean
  accent: string
  teal: string
  ink: string
  titleFont: string
  descFont: string
}

function Overlay({
  reduce,
  onEnter,
  opening,
  accent,
  teal,
  ink,
  titleFont,
  descFont,
}: OverlayProps) {
  // Under reduced motion, render the final settled state (no entrance).
  const fadeUp = (delay: number) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="flex max-w-2xl flex-col items-center text-center">
      <motion.p
        {...fadeUp(0.05)}
        className="mb-5 text-[11px] sm:text-xs"
        style={{
          fontFamily: descFont,
          color: accent,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        The Table Theory · Est. 2026
      </motion.p>

      <motion.h1
        {...fadeUp(0.15)}
        className="mb-5 leading-[1.05]"
        style={{
          fontFamily: titleFont,
          color: ink,
          fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
          fontWeight: 500,
        }}
      >
        Every Table Has{' '}
        <span style={{ color: teal, fontStyle: 'italic' }}>A Story.</span>
      </motion.h1>

      <motion.p
        {...fadeUp(0.28)}
        className="mb-2 text-base sm:text-lg"
        style={{ fontFamily: descFont, color: ink, opacity: 0.78 }}
      >
        Food · Coffee · Conversations
      </motion.p>

      <motion.p
        {...fadeUp(0.36)}
        className="mb-7 text-sm sm:text-base"
        style={{
          fontFamily: titleFont,
          color: accent,
          fontStyle: 'italic',
          opacity: 0.9,
        }}
      >
        Sit Down. Open Up.
      </motion.p>

      <motion.button
        {...fadeUp(0.46)}
        type="button"
        onClick={onEnter}
        disabled={opening}
        whileHover={reduce ? undefined : { scale: 1.04 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        className="rounded-full px-9 py-3.5 text-sm font-medium shadow-sm transition-shadow hover:shadow-md disabled:opacity-80"
        style={{
          fontFamily: descFont,
          background: accent,
          color: '#F5EFE2',
          letterSpacing: '0.04em',
        }}
      >
        Open Menu
      </motion.button>

      <motion.p
        {...fadeUp(0.58)}
        className="mt-6 max-w-xs text-[11px] sm:text-xs"
        style={{ fontFamily: descFont, color: ink, opacity: 0.5 }}
      >
        An envelope arrives with every order. Open after the first bite.
      </motion.p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Three.js scene                                                      */
/* ------------------------------------------------------------------ */

interface SceneProps {
  accent: string
  paper: string
  flapPaper: string
  wax: string
  sage: string
  opening: boolean
}

function Scene({ accent, paper, flapPaper, wax, sage, opening }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color="#FFF7E8" />
      <pointLight position={[-4, -2, 3]} intensity={0.35} color={sage} />

      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
        <Envelope
          accent={accent}
          paper={paper}
          flapPaper={flapPaper}
          wax={wax}
          opening={opening}
        />
      </Float>

      <Motes color={sage} />
    </>
  )
}

interface EnvelopeProps {
  accent: string
  paper: string
  flapPaper: string
  wax: string
  opening: boolean
}

function Envelope({ accent, paper, flapPaper, wax, opening }: EnvelopeProps) {
  const group = useRef<THREE.Group>(null)
  const flapHinge = useRef<THREE.Group>(null)

  // Gentle pointer parallax — lerp the group toward the cursor.
  // Plus: when `opening`, swing the flap up about its hinge (the top edge).
  useFrame((state) => {
    const g = group.current
    if (g) {
      const targetY = state.pointer.x * 0.3
      const targetX = -state.pointer.y * 0.3
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetY, 0.04)
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetX, 0.04)
    }

    const hinge = flapHinge.current
    if (hinge) {
      hinge.rotation.x = THREE.MathUtils.lerp(
        hinge.rotation.x,
        opening ? -2.5 : 0,
        0.12,
      )
    }
  })

  // Body dimensions (a thin, slightly landscape rectangle).
  const W = 2.6
  const H = 1.7
  const D = 0.12

  // Triangular flap built from a flat Shape so its point meets the seal.
  // The geometry is authored with its TOP edge at local y=0 so the wrapping
  // hinge <group> (placed at the body's top edge) can rotate it cleanly.
  const flapGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-W / 2, 0)
    shape.lineTo(W / 2, 0)
    shape.lineTo(0, -H / 2)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])

  // Forest outline that traces the envelope silhouette.
  const outlinePoints = useMemo(() => {
    const z = D / 2 + 0.002
    return [
      new THREE.Vector3(-W / 2, -H / 2, z),
      new THREE.Vector3(W / 2, -H / 2, z),
      new THREE.Vector3(W / 2, H / 2, z),
      new THREE.Vector3(-W / 2, H / 2, z),
      new THREE.Vector3(-W / 2, -H / 2, z),
    ]
  }, [])

  const outlineGeometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(outlinePoints),
    [outlinePoints],
  )

  // The two diagonals of the closed flap, drawn just above the paper.
  // Built as discrete segments for use with <lineSegments> (the lowercase
  // <line> JSX tag collides with the SVG intrinsic under TSX).
  const flapLineGeometry = useMemo(() => {
    const z = D / 2 + 0.006
    const pts = [
      new THREE.Vector3(-W / 2, H / 2, z),
      new THREE.Vector3(0, 0, z),
      new THREE.Vector3(0, 0, z),
      new THREE.Vector3(W / 2, H / 2, z),
    ]
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  return (
    <group ref={group}>
      {/* Paper body */}
      <RoundedBox args={[W, H, D]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color={paper} roughness={0.9} metalness={0} />
      </RoundedBox>

      {/* Closed triangular flap, hinged at the body's top edge so it can swing
          open. The hinge group lives at y=H/2; the flap geometry's top edge is
          at local y=0, so rotating the group pivots about the fold. */}
      <group ref={flapHinge} position={[0, H / 2, D / 2 + 0.004]}>
        <mesh geometry={flapGeometry}>
          <meshStandardMaterial
            color={flapPaper}
            roughness={0.95}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Forest silhouette outline */}
      <lineLoop geometry={outlineGeometry}>
        <lineBasicMaterial color={accent} transparent opacity={0.55} />
      </lineLoop>

      {/* Flap fold lines */}
      <lineSegments geometry={flapLineGeometry}>
        <lineBasicMaterial color={accent} transparent opacity={0.45} />
      </lineSegments>

      {/* Wax seal at the flap point */}
      <mesh position={[0, 0, D / 2 + 0.05]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color={wax} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Subtle raised ring on the seal */}
      <mesh position={[0, 0, D / 2 + 0.11]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.11, 0.012, 12, 32]} />
        <meshStandardMaterial color="#7E3526" roughness={0.5} metalness={0.15} />
      </mesh>
    </group>
  )
}

/* A handful of slow-drifting sage motes for ambient depth. */
function Motes({ color }: { color: string }) {
  const points = useRef<THREE.Points>(null)
  const COUNT = 40

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 7
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2 - 1
    }
    return arr
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [positions])

  useFrame((state) => {
    const p = points.current
    if (!p) return
    p.rotation.y = state.clock.elapsedTime * 0.02
    p.position.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.1
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.5}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* Reduced-motion static poster                                        */
/* ------------------------------------------------------------------ */

function StaticPoster({
  bg,
  accent,
  sage,
  wax,
}: {
  bg: string
  accent: string
  sage: string
  wax: string
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 50% 42%, ${sage}55 0%, ${bg} 62%)`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width="320"
          height="220"
          viewBox="0 0 320 220"
          fill="none"
          style={{ maxWidth: '70vw', opacity: 0.9 }}
        >
          {/* Envelope body */}
          <rect
            x="40"
            y="50"
            width="240"
            height="150"
            rx="8"
            fill="#EFE7D6"
            stroke={accent}
            strokeWidth="2.5"
          />
          {/* Flap */}
          <path
            d="M40 58 L160 140 L280 58"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Wax seal */}
          <circle cx="160" cy="125" r="20" fill={wax} stroke="#7E3526" strokeWidth="2" />
          <circle cx="160" cy="125" r="11" fill="none" stroke="#F5EFE2" strokeWidth="1.5" opacity="0.8" />
        </svg>
      </div>
    </div>
  )
}
