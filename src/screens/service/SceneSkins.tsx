import { useState, useEffect } from 'react'
import { Croissant } from 'lucide-react'
import { LqipVideo } from '../../components/atoms/LqipVideo'
import { videoRenditions } from '../../data/videoManifest'

// ─── Waiter SVG silhouette (CSS skin) ────────────────────────────────────────

function WaiterFigureSvg({ walking = false }: { walking?: boolean }) {
  const legLStyle: React.CSSProperties = walking ? {
    transformOrigin: '33px 118px',
    animation: 'waiter-leg-l 0.46s ease-in-out infinite',
  } : {}
  const legRStyle: React.CSSProperties = walking ? {
    transformOrigin: '47px 118px',
    animation: 'waiter-leg-r 0.46s ease-in-out 0.23s infinite',
  } : {}

  return (
    <svg viewBox="0 0 80 208" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* head */}
      <circle cx="40" cy="22" r="10" fill="var(--ink)" />
      {/* neck */}
      <rect x="36" y="30" width="8" height="6" fill="var(--ink)" />
      {/* shoulders + body */}
      <path d="M22 42 Q40 36 58 42 L60 90 Q40 96 20 90 Z" fill="var(--ink)" />
      {/* apron */}
      <path d="M26 60 Q40 64 54 60 L56 120 Q40 124 24 120 Z" fill="var(--ink-soft)" />
      <path d="M26 60 L24 56 L40 50 L56 56 L54 60" fill="var(--ink)" />
      {/* left arm resting */}
      <path d="M22 42 Q14 60 18 90 L24 90 Q22 60 28 50 Z" fill="var(--ink)" />
      {/* right arm + tray */}
      <g style={{ transformOrigin: '54px 44px', animation: 'waiter-arm 0.65s ease-in-out infinite alternate' }}>
        <path d="M58 42 Q70 38 72 28 L66 24 Q60 32 54 40 Z" fill="var(--ink)" />
        <ellipse cx="68" cy="22" rx="16" ry="3.5" fill="var(--ink-soft)" />
        <ellipse cx="68" cy="20.5" rx="16" ry="3" fill="var(--ink)" opacity="0.7" />
        <ellipse cx="68" cy="18" rx="9" ry="2.4" fill="var(--maroon)" />
        <ellipse cx="68" cy="17.2" rx="6" ry="1.6" fill="var(--gold)" opacity="0.75" />
      </g>
      {/* left leg + shoe */}
      <g style={legLStyle}>
        <path d="M28 118 L26 196 L36 196 L38 120 Z" fill="var(--ink)" />
        <ellipse cx="30" cy="200" rx="10" ry="3.5" fill="var(--ink)" />
      </g>
      {/* right leg + shoe */}
      <g style={legRStyle}>
        <path d="M42 120 L44 196 L54 196 L52 118 Z" fill="var(--ink)" />
        <ellipse cx="50" cy="200" rx="10" ry="3.5" fill="var(--ink)" />
      </g>
    </svg>
  )
}

// ─── Water pour scene (CSS skin) ─────────────────────────────────────────────

const BUBBLES = [
  { left: '22%', delay: '0s',    size: 4, duration: '2.1s' },
  { left: '52%', delay: '0.35s', size: 3, duration: '1.75s' },
  { left: '68%', delay: '0.7s',  size: 5, duration: '2.5s' },
  { left: '38%', delay: '1.1s',  size: 3, duration: '1.95s' },
]

function WaterPourScene({ animKey }: { animKey: number }) {
  const [full, setFull] = useState(false)
  const [poured, setPoured] = useState(false)
  const [showPop, setShowPop] = useState(false)

  useEffect(() => {
    setFull(false)
    setPoured(false)
    setShowPop(false)
    const t1 = setTimeout(() => setFull(true), 250)
    const t2 = setTimeout(() => { setPoured(true); setShowPop(true) }, 1900)
    const t3 = setTimeout(() => setShowPop(false), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [animKey])

  return (
    <div
      className="relative flex items-end justify-center rounded-2xl overflow-hidden mb-4"
      style={{ height: 160, background: 'rgba(180,215,230,0.06)', border: '1px solid rgba(180,215,230,0.28)' }}
    >
      <div className="relative" style={{ width: 72, height: 120, marginBottom: 12 }}>
        {/* pour stream */}
        {!poured && (
          <div
            className="absolute"
            style={{
              width: 5,
              top: -34,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, rgba(180,215,230,0.95), rgba(120,180,210,0.5))',
              borderRadius: 3,
              animation: 'water-pour-stream 1.7s ease-out forwards',
              animationDelay: '0.15s',
            }}
          />
        )}
        {/* glass body */}
        <div
          className="absolute inset-0 rounded-b-xl overflow-hidden"
          style={{
            border: '2px solid rgba(42,30,30,0.28)',
            borderTop: 'none',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(42,30,30,0.03))',
          }}
        >
          {/* water fill */}
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              height: full ? '76%' : '0%',
              transition: 'height 1.5s cubic-bezier(0.4,0.05,0.5,1)',
              background: 'linear-gradient(180deg, rgba(180,215,230,0.82), rgba(100,170,210,0.95))',
              overflow: 'hidden',
            }}
          >
            {/* meniscus */}
            <div style={{ position: 'absolute', left: -2, right: -2, top: -3, height: 6, borderRadius: '50%', background: 'rgba(220,240,250,0.72)' }} />
            {/* light refraction stripe */}
            {full && (
              <div
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: '12%', width: '10%',
                  background: 'rgba(255,255,255,0.2)',
                  transform: 'skewX(-6deg)',
                  animation: 'shine-sweep 5s ease-in-out 0.3s infinite',
                }}
              />
            )}
            {/* rising bubbles */}
            {full && BUBBLES.map((b, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', bottom: '8%', left: b.left,
                  width: b.size, height: b.size, borderRadius: '50%',
                  background: 'rgba(220,240,250,0.75)',
                  animation: `bubble-rise ${b.duration} ease-in ${b.delay} infinite, bubble-sway 1s ease-in-out ${b.delay} infinite`,
                }}
              />
            ))}
          </div>
          {/* surface pop ring */}
          {showPop && (
            <div
              style={{
                position: 'absolute',
                left: '50%', top: '24%',
                width: 14, height: 14,
                borderRadius: '50%',
                border: '2px solid rgba(180,215,230,0.9)',
                animation: 'water-surface-pop 0.65s ease-out forwards',
              }}
            />
          )}
        </div>
        {/* condensation drops on glass exterior */}
        {full && (
          <>
            <div style={{ position: 'absolute', right: -5, top: '28%', width: 3, height: 7, borderRadius: 2, background: 'rgba(180,215,230,0.6)', animation: 'condense-drip 2.6s ease-in 0.4s infinite' }} />
            <div style={{ position: 'absolute', right: -5, top: '52%', width: 2, height: 5, borderRadius: 2, background: 'rgba(180,215,230,0.5)', animation: 'condense-drip 3.2s ease-in 1.2s infinite' }} />
            <div style={{ position: 'absolute', left: -5, top: '42%', width: 2, height: 6, borderRadius: 2, background: 'rgba(180,215,230,0.5)', animation: 'condense-drip 2.9s ease-in 0.8s infinite' }} />
          </>
        )}
      </div>
      {/* label */}
      <p
        className="absolute bottom-2 left-0 right-0 text-center font-inter text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--mute)' }}
      >
        {poured ? 'Choose your preference' : 'Pouring…'}
      </p>
    </div>
  )
}

// ─── Skins: pick video (media mode) or the CSS/SVG scene ─────────────────────

/** Animated SVG waiter (image-mode skin only). */
export function WaiterFigure({ walking }: { walking: boolean }) {
  return <WaiterFigureSvg walking={walking} />
}

/** Full-bleed waiter video — fills its (relative) container, no approach/sway animation. */
export function WaiterVideo() {
  return (
    <LqipVideo
      renditions={videoRenditions('waiter')}
      poster="/assets/covers/cover-classic-poster.webp"
      alt="Your waiter is on the way"
      play="eager"
      wrapperStyle={{ position: 'absolute', inset: 0 }}
      videoClassName="w-full h-full object-cover"
    />
  )
}

/** Water scene header above the preference grid. */
export function WaterScene({ animKey, posterOnly }: { animKey: number; posterOnly: boolean }) {
  if (posterOnly) return <WaterPourScene animKey={animKey} />
  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4"
      style={{ height: 160, border: '1px solid rgba(180,215,230,0.28)' }}
    >
      <LqipVideo
        renditions={videoRenditions('water')}
        poster="/assets/dishes/bev-005-hero.webp"
        alt="Pouring fresh water"
        play="visible"
        wrapperStyle={{ position: 'absolute', inset: 0 }}
        videoClassName="w-full h-full object-cover"
      />
    </div>
  )
}

/** Bread / sourdough scene header. */
export function BreadScene({ posterOnly }: { posterOnly: boolean }) {
  if (!posterOnly) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden mb-4"
        style={{ height: 160, border: '1px solid rgba(217,160,58,0.28)' }}
      >
        <LqipVideo
          renditions={videoRenditions('bread')}
          poster="/assets/dishes/qb-004-hero.webp"
          alt="Warm sourdough basket"
          play="visible"
          wrapperStyle={{ position: 'absolute', inset: 0 }}
          videoClassName="w-full h-full object-cover"
        />
      </div>
    )
  }
  // CSS fallback — warm gradient + croissant + rising steam wisps.
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl overflow-hidden mb-4"
      style={{ height: 160, background: 'linear-gradient(160deg, #C8821E 0%, #8B4513 60%, #5c2e0a 100%)' }}
    >
      {[30, 50, 70].map((left, i) => (
        <span
          key={left}
          className="absolute"
          style={{
            left: `${left}%`, bottom: '38%',
            width: 8, height: 40, borderRadius: 8,
            background: 'linear-gradient(to top, rgba(255,248,234,0.32), transparent)',
            filter: 'blur(3px)',
            animation: `steam-rise 2.4s ease-in ${i * 0.5}s infinite, steam-sway 1.6s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
      <Croissant size={56} strokeWidth={1.25} style={{ color: 'rgba(255,248,234,0.92)', position: 'relative' }} />
    </div>
  )
}
