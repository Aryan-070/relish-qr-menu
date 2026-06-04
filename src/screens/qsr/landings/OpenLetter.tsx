import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Shared "letter unfolds → fullscreen" landing→menu transition ────────────
// Each landing variant plays its own 3D flourish (envelope flap opens, particles
// bloom, bowl zooms) for a beat, then this cream "letter" panel expands from a
// small card at centre to full-bleed and hands off to the menu via onComplete.
// One mechanism → an identical, seamless handoff across all three variants.

/** Manages the opening flag. `begin()` starts the sequence; pass `opening` to
 *  both the 3D flourish and <OpenLetter />. */
export function useOpenTransition() {
  const [opening, setOpening] = useState(false)
  const begin = useCallback(() => setOpening(true), [])
  return { opening, begin }
}

export interface OpenLetterProps {
  opening: boolean
  /** prefers-reduced-motion: skip the grow, do a quick fade. */
  reduced: boolean
  /** Cream letter colour (the surface). */
  color: string
  /** Wordmark colour + serif font shown briefly as the letter unfolds. */
  inkColor: string
  font: string
  /** Called once the letter fills the screen — swap to the menu here. */
  onComplete: () => void
  /** Seconds the variant flourish plays before the letter starts expanding. */
  flourishDelay?: number
}

export function OpenLetter({
  opening, reduced, color, inkColor, font, onComplete, flourishDelay = 0.35,
}: OpenLetterProps) {
  // Fire onComplete exactly once. `onAnimationComplete` is the happy path, but a
  // backgrounded/throttled tab can stall rAF and never emit it — so a timeout
  // matched to the animation duration guarantees the handoff to the menu.
  const done = useRef(false)
  const complete = useCallback(() => {
    if (done.current) return
    done.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (!opening) { done.current = false; return }
    const ms = reduced ? 220 : (flourishDelay + 0.62 + 0.15) * 1000
    const id = window.setTimeout(complete, ms)
    return () => window.clearTimeout(id)
  }, [opening, reduced, flourishDelay, complete])

  return (
    <AnimatePresence>
      {opening && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden"
          style={{ pointerEvents: 'none' }}
          initial={{ opacity: reduced ? 0 : 1 }}
          animate={{ opacity: 1 }}
          aria-hidden
        >
          <motion.div
            className="flex items-center justify-center"
            style={{ background: color, boxShadow: '0 24px 90px rgba(11,74,47,0.28)' }}
            initial={reduced
              ? { opacity: 0, width: '130vmax', height: '130vmax', borderRadius: 0 }
              : { width: 240, height: 150, borderRadius: 18, opacity: 1 }}
            animate={reduced
              ? { opacity: 1 }
              : { width: '135vmax', height: '135vmax', borderRadius: 0 }}
            transition={reduced
              ? { duration: 0.14 }
              : { duration: 0.62, delay: flourishDelay, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={complete}
          >
            <motion.span
              className="text-center px-6"
              style={{ fontFamily: font, color: inkColor, fontSize: 'clamp(1.1rem, 4vw, 1.8rem)', letterSpacing: '0.02em' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: reduced ? 0 : [0, 1, 1, 0] }}
              transition={reduced ? { duration: 0 } : { duration: 0.9, delay: flourishDelay, times: [0, 0.3, 0.7, 1] }}
            >
              The Table Theory
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
