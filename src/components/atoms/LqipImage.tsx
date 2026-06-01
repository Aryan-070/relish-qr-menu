import { useState } from 'react'
import type { CSSProperties } from 'react'

interface LqipImageProps {
  src: string
  alt: string
  /** classes on the wrapper (set sizing/aspect/radius here) */
  wrapperClassName?: string
  wrapperStyle?: CSSProperties
  /** classes on the <img> (usually object-cover w-full h-full) */
  imgClassName?: string
  /** placeholder background shown while loading */
  placeholder?: string
  onError?: () => void
  draggable?: boolean
}

/**
 * Blur-up image: shows a tinted shimmer placeholder, then fades + un-blurs the
 * real image once it loads. Lazy-loaded. Smooths the menu's image-heavy lists.
 */
export function LqipImage({
  src,
  alt,
  wrapperClassName = '',
  wrapperStyle,
  imgClassName = '',
  placeholder = 'linear-gradient(135deg, rgba(217,160,58,0.16), rgba(139,16,36,0.07))',
  onError,
  draggable = false,
}: LqipImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <span
      className={`relative block overflow-hidden ${wrapperClassName}`}
      style={{ background: placeholder, ...wrapperStyle }}
    >
      {!loaded && <span className="absolute inset-0 lqip-shimmer" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={draggable}
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={imgClassName}
        style={{
          opacity: loaded ? 1 : 0,
          filter: loaded ? 'blur(0px)' : 'blur(14px)',
          transform: loaded ? 'scale(1)' : 'scale(1.05)',
          transition: 'opacity 0.5s ease, filter 0.6s ease, transform 0.6s ease',
        }}
      />
    </span>
  )
}
