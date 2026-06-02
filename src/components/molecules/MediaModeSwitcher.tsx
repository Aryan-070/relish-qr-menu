import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Film, X } from 'lucide-react'
import { useMediaMode, type MediaMode } from '../../theme/MediaModeContext'

type ScreenKind = 'cover' | 'menu' | 'recommend'

interface MediaModeSwitcherProps {
  /** Current screen — anchored opposite the ThemeSwitcher so the two never collide. */
  screen?: ScreenKind
}

const MODES: Array<{ id: MediaMode; label: string }> = [
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Photo' },
]

/**
 * Floating Video / Photo toggle — the "see how it looks" comparison control.
 * Mirror of ThemeSwitcher, anchored on the opposite corner per screen.
 */
export function MediaModeSwitcher({ screen = 'menu' }: MediaModeSwitcherProps) {
  const { mode, setMode } = useMediaMode()
  const [open, setOpen] = useState(false)

  // Opposite corner from ThemeSwitcher (which sits right-on-menu, left elsewhere).
  const anchor: React.CSSProperties =
    screen === 'menu'
      ? { left: 12, bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)' }
      : screen === 'recommend'
        ? { right: 12, bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }
        : { right: 12, bottom: 12 } // cover

  const openLeft = anchor.left !== undefined

  return (
    <>
      {/* Tap-scrim to dismiss when expanded */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close media-mode picker"
            className="fixed inset-0 z-[69]"
            style={{ background: 'transparent' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="absolute z-[70] flex items-center gap-2" style={anchor}>
        {/* Film / close toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close media-mode picker' : 'Open media-mode picker'}
          aria-expanded={open}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            order: openLeft ? 0 : 2,
            background: open ? 'rgba(139,16,36,0.92)' : 'rgba(255,255,255,0.78)',
            border: open ? '1px solid #8B1024' : '1px solid rgba(0,0,0,0.12)',
            color: open ? '#FFF8EA' : 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
          }}
        >
          {open ? <X size={16} strokeWidth={2.4} /> : <Film size={16} strokeWidth={2.2} />}
        </motion.button>

        {/* Expanding pills */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="media-pills"
              initial={{ opacity: 0, scale: 0.9, x: openLeft ? -8 : 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: openLeft ? -8 : 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="flex items-center gap-1"
              style={{ order: 1 }}
            >
              <span
                className="font-inter uppercase mr-0.5"
                style={{ fontSize: 7, letterSpacing: '0.18em', color: 'rgba(0,0,0,0.4)' }}
                aria-hidden
              >
                Media
              </span>
              {MODES.map(m => {
                const active = mode === m.id
                return (
                  <motion.button
                    key={m.id}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMode(m.id)}
                    aria-pressed={active}
                    aria-label={`${m.label} mode`}
                    className="px-2.5 py-1 rounded-full font-inter uppercase tracking-widest"
                    style={{
                      fontSize: 8,
                      minHeight: 28,
                      background: active ? 'rgba(139,16,36,0.92)' : 'rgba(255,255,255,0.82)',
                      border: active ? '1px solid #8B1024' : '1px solid rgba(0,0,0,0.12)',
                      color: active ? '#FFF8EA' : 'rgba(0,0,0,0.55)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      boxShadow: active ? '0 2px 8px rgba(139,16,36,0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    {m.label}
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
