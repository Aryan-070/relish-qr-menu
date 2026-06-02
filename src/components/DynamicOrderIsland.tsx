import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingBag, BellRing, CheckCircle2 } from 'lucide-react'
import { AnimatedNumber } from './ui/animated-number'
import { formatMoney } from '../lib/money'

export type IslandMode = 'idle' | 'cart' | 'placed' | 'waiter'

interface DynamicOrderIslandProps {
  mode: IslandMode
  count: number
  total: number
  onView?: () => void
}

const enter = { opacity: 1, scale: 1 }
const exit = { opacity: 0, scale: 0.85 }
const from = { opacity: 0, scale: 0.85 }
const spring = { type: 'spring' as const, stiffness: 460, damping: 30, mass: 0.6 }

/**
 * Apple-style status pill, mounted top-center on the guest menu. The pill sizes
 * to fit whichever state is active (idle dot → cart with count + live total →
 * placed → waiter) and crossfades between them. Black by design — a deliberate
 * premium contrast on the cream surface.
 */
export function DynamicOrderIsland({ mode, count, total, onView }: DynamicOrderIslandProps) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <motion.div
        className="pointer-events-auto inline-flex items-center justify-center"
        transition={spring}
        style={{
          background: '#0B0B0C',
          color: '#FFFFFF',
          borderRadius: 9999,
          minHeight: 34,
          minWidth: 34,
          boxShadow: '0 10px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'idle' && (
            <motion.span
              key="idle"
              initial={from}
              animate={enter}
              exit={exit}
              transition={spring}
              className="block h-2 w-2 rounded-full bg-white/70"
              aria-hidden
            />
          )}

          {mode === 'cart' && (
            <motion.button
              key="cart"
              type="button"
              initial={from}
              animate={enter}
              exit={exit}
              transition={spring}
              onClick={onView}
              className="flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-[12px] font-medium text-white"
              aria-label={`View order — ${count} item${count !== 1 ? 's' : ''}`}
            >
              <ShoppingBag size={13} strokeWidth={2.2} />
              <span>{count} item{count !== 1 ? 's' : ''}</span>
              <span className="opacity-40">·</span>
              <span style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace" }}>
                <AnimatedNumber value={total} format={formatMoney} />
              </span>
            </motion.button>
          )}

          {mode === 'placed' && (
            <motion.span
              key="placed"
              initial={from}
              animate={enter}
              exit={exit}
              transition={spring}
              className="flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-[12px] font-medium text-white"
            >
              <CheckCircle2 size={14} strokeWidth={2.2} className="text-emerald-400" />
              Sent to kitchen
            </motion.span>
          )}

          {mode === 'waiter' && (
            <motion.span
              key="waiter"
              initial={from}
              animate={enter}
              exit={exit}
              transition={spring}
              className="flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-[12px] font-medium text-white"
            >
              <BellRing size={14} strokeWidth={2.2} className="text-amber-300" />
              Waiter on the way
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
