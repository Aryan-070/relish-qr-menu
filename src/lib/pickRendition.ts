// Network-adaptive rendition selection for short, muted, looping background clips.
//
// Approach (per research): multi-rendition static MP4 + the Network Information
// API, which is Chromium-only — Safari/iOS/Firefox return `undefined`, so we
// default to a sensible 720p there (NO bandwidth probe). saveData / reduced-data
// / reduced-motion → poster-only (null). The chosen src is picked ONCE at mount;
// we never swap mid-playback for a decorative loop.

export interface Rendition {
  height: number // 360 | 480 | 720 | 1080
  src: string
}

interface NetworkInformationLike {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  downlink?: number
  saveData?: boolean
}

export interface PickOpts {
  /** Honor reduced-motion / reduced-data → poster only. */
  prefersReducedData?: boolean
  /** Test seam / override. */
  connection?: NetworkInformationLike | null
  /** Height to use when the Network Information API is unavailable (Safari/Firefox/iOS). */
  fallbackHeight?: number
}

/** Highest rendition whose height ≤ target, or the smallest available if none qualify. */
function atOrBelow(ladderAsc: Rendition[], target: number): Rendition {
  let pick = ladderAsc[0]
  for (const r of ladderAsc) {
    if (r.height <= target) pick = r
    else break
  }
  return pick
}

function readConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
}

/**
 * Returns the best matching src for the current network, or `null` for poster-only.
 * Pure & deterministic given opts → unit-testable.
 */
export function pickRendition(renditions: Rendition[], opts: PickOpts = {}): string | null {
  if (renditions.length === 0) return null

  const ladder = [...renditions].sort((a, b) => a.height - b.height)
  const conn = opts.connection === undefined ? readConnection() : opts.connection

  // 1. Hard override → poster only.
  if (opts.prefersReducedData || conn?.saveData) return null

  // 2. No Network Information API (Safari/Firefox/iOS): sensible default, no probe.
  if (!conn || !conn.effectiveType) {
    return atOrBelow(ladder, opts.fallbackHeight ?? 720).src
  }

  // 3. effectiveType → target height, refined by downlink at the top end.
  let target: number
  switch (conn.effectiveType) {
    case 'slow-2g':
    case '2g':
      target = 360
      break
    case '3g':
      target = 480
      break
    case '4g':
    default:
      target = (conn.downlink ?? 0) > 5 ? 1080 : 720
      break
  }
  return atOrBelow(ladder, target).src
}
