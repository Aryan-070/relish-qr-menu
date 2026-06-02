import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { LqipImage } from './LqipImage'
import { acquire, release } from '../../lib/videoPlayback'
import { pickRendition, type Rendition } from '../../lib/pickRendition'

interface LqipVideoProps {
  /** Single resolved source (legacy / fixed-quality). Prefer `renditions`. */
  src?: string
  /** Network-adaptive renditions (height + src). The best one is picked once at mount. */
  renditions?: Rendition[]
  /** Poster image (an existing dish/banner .webp) — shown first, and the fallback still. */
  poster: string
  alt: string
  /** classes on the wrapper (set sizing/aspect/radius here) — same contract as LqipImage */
  wrapperClassName?: string
  wrapperStyle?: CSSProperties
  /** classes on the <video> (usually 'w-full h-full object-cover') */
  videoClassName?: string
  /** placeholder background shown while the poster loads */
  placeholder?: string
  /** 'visible' = play only when on-screen (default); 'eager' = mount + autoplay immediately */
  play?: 'visible' | 'eager'
  /** force poster-only — image mode / reduced-motion / data-saver. Skips the <video> entirely. */
  posterOnly?: boolean
  /** IntersectionObserver pre-roll margin */
  rootMargin?: string
  /** fires only when the POSTER image fails (a missing video silently degrades to the
   *  poster), so callers keep their own final fallback (icon / illustration / gradient) */
  onError?: () => void
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Looping video with an LqipImage poster underneath. Plays only while on-screen
 * (IntersectionObserver), capped by a global concurrency governor, muted + inline
 * for autoplay. Falls back: video → poster image → caller fallback (icon/gradient).
 * When `posterOnly` (image mode / reduced-motion), it renders a plain LqipImage —
 * zero <video> cost — so the app degrades to its exact pre-video behaviour.
 */
export function LqipVideo({
  src,
  renditions,
  poster,
  alt,
  wrapperClassName = '',
  wrapperStyle,
  videoClassName = 'w-full h-full object-cover',
  placeholder,
  play = 'visible',
  posterOnly = false,
  rootMargin = '200px',
  onError,
}: LqipVideoProps) {
  // Pick the network-appropriate rendition ONCE at mount (no runtime swaps for a
  // decorative loop). null → poster-only (saveData / reduced-data).
  const [chosenSrc] = useState<string | null>(() =>
    renditions && renditions.length > 0
      ? pickRendition(renditions, { prefersReducedData: posterOnly })
      : (src ?? null),
  )
  const staticOnly = posterOnly || prefersReducedMotion() || !chosenSrc

  const wrapperRef = useRef<HTMLSpanElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Persists the element across unmount — React nulls videoRef.current during the
  // commit phase, before the passive cleanup runs, so we'd otherwise leak slots.
  const elRef = useRef<HTMLVideoElement | null>(null)
  const intersecting = useRef(play === 'eager')
  const [active, setActive] = useState(play === 'eager') // mount + assign src
  const [ready, setReady] = useState(false) // first frame painted → fade in
  const [failed, setFailed] = useState(false)

  // Request a slot (capped globally) and start playback once the video exists.
  // `vid.muted = true` is set imperatively — React can drop the muted attribute,
  // and an un-muted video fails autoplay on mobile.
  const tryPlay = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    const start = () => { vid.muted = true; vid.play().catch(() => {}) }
    if (acquire(vid, start)) start()
  }, [])

  // Play on visible, pause off-visible. Defers <video> mount (and its fetch) to
  // first intersection so off-screen cards download nothing.
  useEffect(() => {
    if (staticOnly || failed) return
    const wrap = wrapperRef.current
    if (!wrap || typeof IntersectionObserver === 'undefined') return

    const obs = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        intersecting.current = entry.isIntersecting
        if (entry.isIntersecting) {
          setActive(true) // first hit may mount the <video>; the effect below plays it
          tryPlay()
        } else {
          const vid = videoRef.current
          if (vid) {
            vid.pause()
            release(vid)
          }
        }
      },
      { rootMargin, threshold: 0.25 },
    )
    obs.observe(wrap)
    return () => obs.disconnect()
  }, [staticOnly, failed, rootMargin, tryPlay])

  // When the <video> mounts (active flips true) while on-screen, start it — the
  // observer's first intersection couldn't, because the element didn't exist yet.
  useEffect(() => {
    if (active && intersecting.current) tryPlay()
  }, [active, tryPlay])

  // Release the playback slot on unmount (use the persistent ref — videoRef.current
  // is already null by the time this passive cleanup runs).
  useEffect(() => {
    return () => {
      if (elRef.current) release(elRef.current)
    }
  }, [])

  // Image mode / reduced-motion / video failed → behave exactly like LqipImage.
  if (staticOnly || failed) {
    return (
      <LqipImage
        src={poster}
        alt={alt}
        wrapperClassName={wrapperClassName}
        wrapperStyle={wrapperStyle}
        imgClassName={videoClassName}
        placeholder={placeholder}
        onError={onError}
      />
    )
  }

  return (
    <span
      ref={wrapperRef}
      className={`block overflow-hidden ${wrapperClassName}`}
      /* position via inline style so a caller's `absolute inset-0` (passed as
         wrapperStyle) wins — a `relative` utility class would otherwise beat
         `absolute` on CSS source order and collapse the box to 0 height. */
      style={{ position: 'relative', ...wrapperStyle }}
    >
      {/* Poster layer — always underneath; carries the blur-up + gradient placeholder. */}
      <LqipImage
        src={poster}
        alt={alt}
        wrapperClassName=""
        wrapperStyle={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        imgClassName={videoClassName}
        placeholder={placeholder}
        onError={onError}
      />
      {active && chosenSrc && (
        <video
          ref={node => { videoRef.current = node; if (node) elRef.current = node }}
          src={chosenSrc}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={play === 'eager'}
          preload="none"
          aria-label={alt}
          onCanPlay={() => {
            const vid = videoRef.current
            if (play === 'eager' && vid) {
              const start = () => { vid.muted = true; vid.play().catch(() => {}) }
              if (acquire(vid, start)) start()
            }
          }}
          onPlaying={() => setReady(true)}
          /* video 404/decode-fail → degrade to the poster image (still real). The
             caller's onError is reserved for when the poster itself fails. */
          onError={() => setFailed(true)}
          className={`absolute inset-0 ${videoClassName}`}
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.6s ease' }}
        />
      )}
    </span>
  )
}
