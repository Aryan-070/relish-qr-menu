import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { motion, useReducedMotion } from 'framer-motion'
import * as THREE from 'three'
import { useTheme } from '../../../theme/ThemeContext'
import { OpenLetter, useOpenTransition } from './OpenLetter'

/**
 * QsrLandingBowl — full-screen brand hero for The Table Theory QSR café.
 *
 * Centrepiece: a low-poly, faceted signature bowl that turns slowly on its
 * axis with a gentle bob, garnished with rice and herb "ingredients". The
 * scene is built entirely from three.js primitives — no external textures,
 * models, HDRIs or drei presets — so it runs fully offline.
 *
 * Honours `prefers-reduced-motion`: when reduced, the Canvas is never mounted
 * and a static cream→sage poster with an inline-SVG bowl glyph is shown
 * instead, with all entrance text rendered in its final (settled) state.
 */

const TEAL = '#1E6E63'
const RICE = '#F3ECDA'

/** The faceted bowl + its ingredients, animated as one group. */
function Bowl({ accent, accent2, opening }: { accent: string; accent2: string; opening: boolean }) {
  const group = useRef<THREE.Group>(null)

  // Scatter a handful of "rice" + "garnish" bits across the bowl mouth once.
  const ingredients = useMemo(() => {
    const bits: {
      pos: [number, number, number]
      scale: number
      color: string
      kind: 'rice' | 'cube'
    }[] = []
    const palette = [accent2, TEAL, RICE, RICE, RICE]
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.4
      const radius = 0.18 + ((i * 37) % 60) / 100
      bits.push({
        pos: [
          Math.cos(angle) * radius,
          0.02 + ((i * 53) % 9) / 100,
          Math.sin(angle) * radius,
        ],
        scale: 0.05 + ((i * 17) % 5) / 100,
        color: palette[i % palette.length],
        kind: i % 4 === 0 ? 'cube' : 'rice',
      })
    }
    return bits
  }, [accent2])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    // Keep spinning even during the open flourish.
    g.rotation.y += delta * 0.3

    if (opening) {
      // Dolly-in: ease the bowl toward the camera and scale it up so it reads
      // as a zoom, while gently fading the glaze materials out.
      g.position.z = THREE.MathUtils.lerp(g.position.z, 3, 0.1)
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.1)
      const s = THREE.MathUtils.lerp(g.scale.x, 2.2, 0.1)
      g.scale.setScalar(s)
      g.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial
          mat.transparent = true
          mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, 0.1)
        }
      })
      return
    }

    // Gentle vertical bob.
    g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.04
    // Subtle pointer parallax tilt.
    const targetX = state.pointer.y * 0.12
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetX, 0.05)
  })

  return (
    <group ref={group}>
      {/* Bowl shell — lower hemisphere via a clipped sphere, faceted glaze. */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial
          color={accent}
          flatShading
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner glaze — a slightly smaller sage hemisphere for depth. */}
      <mesh position={[0, -0.04, 0]}>
        <sphereGeometry args={[0.92, 20, 14, 0, Math.PI * 2, Math.PI / 2.05, Math.PI / 2]} />
        <meshStandardMaterial
          color={accent2}
          flatShading
          roughness={0.7}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rim torus. */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.99, 0.06, 12, 32]} />
        <meshStandardMaterial color={accent} flatShading roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Ingredients heaped in the bowl. */}
      {ingredients.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow>
          {b.kind === 'cube' ? (
            <boxGeometry args={[b.scale, b.scale, b.scale]} />
          ) : (
            <sphereGeometry args={[b.scale, 8, 6]} />
          )}
          <meshStandardMaterial color={b.color} flatShading roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Scene({ accent, accent2, opening }: { accent: string; accent2: string; opening: boolean }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#FFF3DC" castShadow />
      <pointLight position={[-3, 2, -2]} intensity={0.4} color={accent2} />
      <group position={[0, 0.2, 0]}>
        <Bowl accent={accent} accent2={accent2} opening={opening} />
      </group>
      <ContactShadows
        position={[0, -0.85, 0]}
        opacity={0.28}
        scale={5}
        blur={2.6}
        far={3}
        color="#0B4A2F"
      />
    </>
  )
}

/** Static, motion-free poster shown when the user prefers reduced motion. */
function Poster({ accent, accent2, bg }: { accent: string; accent2: string; bg: string }) {
  return (
    <div
      className="absolute inset-0 z-0"
      aria-hidden
      style={{
        background: `radial-gradient(circle at 50% 38%, ${accent2}55 0%, ${bg} 62%)`,
      }}
    >
      <svg
        viewBox="0 0 200 200"
        className="absolute left-1/2 top-[34%] w-[42vmin] max-w-[320px] -translate-x-1/2 -translate-y-1/2"
        fill="none"
      >
        <ellipse cx="100" cy="86" rx="74" ry="20" fill={accent2} opacity="0.35" />
        <path
          d="M26 86 a74 20 0 0 0 148 0 a74 56 0 0 1 -148 0 Z"
          fill={accent}
        />
        <path d="M26 86 a74 20 0 0 0 148 0" stroke={TEAL} strokeWidth="3" fill="none" opacity="0.5" />
        <circle cx="80" cy="80" r="7" fill={RICE} />
        <circle cx="104" cy="84" r="6" fill={RICE} />
        <circle cx="122" cy="78" r="5" fill={TEAL} />
        <circle cx="92" cy="74" r="4" fill={accent2} />
      </svg>
    </div>
  )
}

export function QsrLandingBowl({ onEnter }: { onEnter: () => void }) {
  const { tokens: t } = useTheme()
  const reduced = useReducedMotion()
  const { opening, begin } = useOpenTransition()

  // Slide-only entrance (no opacity fade): the copy stays visible even if the
  // tab's rAF is throttled/backgrounded, while still reading as a gentle reveal.
  const container = {
    hidden: {},
    show: {
      transition: reduced ? { duration: 0 } : { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  }
  const item = {
    hidden: reduced ? { y: 0 } : { y: 16 },
    show: { y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
  }

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: t.bg }}>
      {/* Shared cream "letter" that grows to fullscreen after the bowl dolly-in,
          then hands off to the menu. Handles reduced-motion (quick fade) itself. */}
      <OpenLetter
        opening={opening}
        reduced={!!reduced}
        color={t.bg}
        inkColor={t.accent}
        font={t.headerFont ?? t.titleFont}
        onComplete={onEnter}
        flourishDelay={0.4}
      />

      {/* Background centrepiece: animated 3D bowl, or a static poster. */}
      {reduced ? (
        <Poster accent={t.accent} accent2={t.accent2} bg={t.bg} />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0">
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.6, 4.5], fov: 45 }} shadows>
            <Scene accent={t.accent} accent2={t.accent2} opening={opening} />
          </Canvas>
        </div>
      )}

      {/* Soft scrim so foreground text stays readable over the scene. */}
      <div
        className="absolute inset-0 z-0"
        aria-hidden
        style={{
          background: `linear-gradient(to bottom, ${t.bg}00 0%, ${t.bg}00 52%, ${t.bg}cc 100%)`,
        }}
      />

      {/* Foreground overlay. */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex h-full w-full flex-col items-center justify-end px-6 pb-[10vh] text-center sm:justify-center sm:pb-0"
      >
        <motion.p
          variants={item}
          className="mb-4 text-[0.7rem] font-medium uppercase tracking-[0.32em] sm:text-xs"
          style={{ color: t.accent, fontFamily: t.descFont }}
        >
          The Table Theory · Est. 2026
        </motion.p>

        <motion.h1
          variants={item}
          className="max-w-3xl font-semibold leading-[1.05] tracking-tight"
          style={{
            fontFamily: t.titleFont,
            color: t.ink,
            fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
          }}
        >
          Every Table Has{' '}
          <span style={{ color: t.accent }}>
            A&nbsp;<span style={{ color: TEAL }}>Story.</span>
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 text-base tracking-[0.18em] sm:text-lg"
          style={{ color: t.ink, fontFamily: t.descFont, opacity: 0.78 }}
        >
          Food · Coffee · Conversations
        </motion.p>

        <motion.p
          variants={item}
          className="mt-2 text-sm italic sm:text-base"
          style={{ color: t.accent, fontFamily: t.titleFont, opacity: 0.85 }}
        >
          Sit Down. Open Up.
        </motion.p>

        <motion.button
          variants={item}
          type="button"
          onClick={begin}
          disabled={opening}
          whileHover={reduced ? undefined : { scale: 1.04, y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          className="mt-10 rounded-full px-9 py-3.5 text-sm font-semibold uppercase tracking-[0.2em] shadow-lg sm:text-base"
          style={{ background: t.accent, color: t.bg, fontFamily: t.descFont }}
        >
          Open Menu
        </motion.button>

        {/* Quiet envelope reference line. */}
        <motion.p
          variants={item}
          className="mt-8 max-w-md text-[0.7rem] leading-relaxed tracking-wide sm:text-xs"
          style={{ color: t.ink, fontFamily: t.descFont, opacity: 0.5 }}
        >
          Pull up a chair — the conversation is the dish, and you're the guest of honour.
        </motion.p>
      </motion.div>
    </div>
  )
}
