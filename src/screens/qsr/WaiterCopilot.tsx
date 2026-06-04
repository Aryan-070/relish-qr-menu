import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Plus,
  Minus,
  Sparkles,
  Send,
  Check,
  Users,
  Flame,
  Leaf,
  Mail,
} from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, sectionTitleStyle, bodyStyle, isHard } from '../../console/lib/skin'
import { Button } from '../../console/components/Button'
import { AnimatedNumber } from '../../components/ui/animated-number'
import { fadeUp, stagger } from '../../animations/variants'
import { cn } from '../../console/lib/format'
import { getCategoryForItem, type QsrMenuItem, type Craving, type QsrMood, type DietFilter } from '../../data/qsrMenu'
import { formatMoney } from '../../lib/money'
import { QSR_TABLES, type QsrTable } from './qsrTables'
import { buildShortlist, useQsrWhisper, envelopeForContext, type QsrContext } from './useQsrWhisper'
import { TastePass } from './TastePass'
import type { OrderApi } from './types'
import type { UseSessionResult } from '../../hooks/useSession'

const VEG_GREEN = '#2e7d4f'
const SPICE_RED = '#c0392b'
const SUCCESS_GREEN = '#2e7d32'

interface WaiterCopilotProps {
  order: OrderApi
  /** Live dining session (present when this device reached /qsr via a QR). */
  session?: UseSessionResult
}

/**
 * Waiter Copilot — the no-hardware pitch on the waiter's own phone.
 * Tap a table → set the Taste Pass (craving / diet / mood) → the menu collapses
 * to the ~12 dishes that matter → tap to build the order → read the one whisper
 * line aloud (and the matching envelope) → fire to the kitchen. AI does only the
 * whisper; everything else is tapping. A cockpit: fast, glanceable, theme-aware.
 */
export function WaiterCopilot({ order, session }: WaiterCopilotProps) {
  const { tokens: t } = useTheme()
  const { orderItems, addItem, addCombo, updateQuantity, clear, total, count } = order
  // A live backend session is present only when this device reached /qsr via a
  // QR. The full staff session cockpit (promote / batch-confirm / close) lives
  // in the authenticated console (Phase 5); here we surface its presence.
  const liveSession = session?.enabled && session.session ? session.session : null

  const [table, setTable] = useState<QsrTable | null>(null)
  const [mood, setMood] = useState<QsrMood | null>(null)
  const [cravings, setCravings] = useState<ReadonlySet<Craving>>(new Set())
  const [dietary, setDietary] = useState<ReadonlySet<DietFilter>>(new Set())
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set())
  const [fired, setFired] = useState<string | null>(null)

  const toggleCraving = useCallback((c: Craving) => {
    setCravings(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }, [])
  const toggleDietary = useCallback((d: DietFilter) => {
    setDietary(prev => {
      const next = new Set(prev)
      if (next.has(d)) { next.delete(d); return next }
      next.add(d)
      if (d === 'veg') next.delete('nonveg')
      if (d === 'nonveg') next.delete('veg')
      return next
    })
  }, [])

  const ctx: QsrContext = useMemo(() => ({ mood, cravings, dietary }), [mood, cravings, dietary])
  const shortlist = useMemo(() => buildShortlist(ctx, 12), [ctx])
  const cartItemIds = useMemo(() => orderItems.map(o => o.item.id), [orderItems])
  const whisper = useQsrWhisper(cartItemIds, ctx, suppressed)
  const envelope = envelopeForContext(ctx)

  const radius = isHard(t) ? 0 : 999

  const openTable = (tbl: QsrTable) => {
    setTable(tbl)
    setMood(null)
    setCravings(new Set())
    setDietary(new Set())
    setSuppressed(new Set())
    clear()
  }

  const acceptWhisper = () => {
    if (!whisper) return
    if (whisper.kind === 'combo') addCombo(whisper.combo)
    else addItem(whisper.item)
  }

  const dismissWhisper = () => {
    if (!whisper) return
    setSuppressed(prev => new Set(prev).add(whisper.id))
  }

  const fire = () => {
    if (!table || count === 0) return
    setFired(`${count} item${count > 1 ? 's' : ''} fired to the kitchen for ${table.label}`)
    clear()
    setSuppressed(new Set())
    window.setTimeout(() => setFired(null), 2600)
  }

  // ── Floor view (no table selected) ────────────────────────────────────────
  if (!table) {
    return (
      <div className="flex flex-col h-full px-4 sm:px-6" style={{ background: t.bg }}>
        <div className="pt-5 pb-3">
          <p className="text-[12px] uppercase tracking-[0.18em]" style={{ ...bodyStyle(t), color: t.descColor }}>
            Your section · dinner rush
          </p>
          <h2 className="font-bold text-[22px]" style={{ ...sectionTitleStyle(t), color: t.accent }}>
            Tap a table to take the order
          </h2>
          {liveSession && (
            <p className="text-[11px] mt-1" style={{ ...bodyStyle(t), color: t.descColor }}>
              Live session active · {liveSession.party_size} at the table ·{' '}
              {liveSession.orders.length} order{liveSession.orders.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex-1 overflow-y-auto pb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {QSR_TABLES.map(tbl => (
            <motion.button
              key={tbl.id}
              variants={fadeUp}
              onClick={() => openTable(tbl)}
              className="text-left p-4 transition-transform active:scale-[0.97]"
              style={panelStyle(t)}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[20px]" style={{ ...sectionTitleStyle(t), color: t.accent }}>
                  {tbl.label}
                </span>
                <span
                  className="text-[11px] px-2 py-0.5"
                  style={{ ...bodyStyle(t), background: `${t.accent}1A`, color: t.accent, borderRadius: radius }}
                >
                  {tbl.zone}
                </span>
              </div>
              <p className="text-[12px] mt-2 flex items-center gap-1" style={{ ...bodyStyle(t), color: t.descColor }}>
                <Users size={13} /> {tbl.seats} seats
              </p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    )
  }

  // ── Order view (table selected) ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative px-4 sm:px-6" style={{ background: t.bg }}>
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_minmax(320px,380px)] lg:gap-6 lg:items-start flex-1 min-h-0">
        {/* LEFT pane: header + Taste Pass + shortlist (scrolls) */}
        <div className="flex flex-col min-h-0 flex-1 lg:h-full">
          <div className="flex-shrink-0 flex items-center gap-3 py-3" style={{ borderBottom: `1.5px solid ${t.ruleColor}` }}>
            <button
              onClick={() => setTable(null)}
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: `${t.accent}1A`, color: t.accent, borderRadius: radius }}
              aria-label="Back to floor"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[18px] leading-none" style={{ ...sectionTitleStyle(t), color: t.accent }}>
                Table {table.label}
              </h2>
              <p className="text-[11px] mt-1" style={{ ...bodyStyle(t), color: t.descColor }}>
                {table.zone} · {table.seats} seats
              </p>
            </div>
          </div>

          {/* Taste Pass — the walk-up context (craving / diet / mood) */}
          <div className="flex-shrink-0 py-3" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
            <TastePass
              cravings={cravings}
              onToggleCraving={toggleCraving}
              dietary={dietary}
              onToggleDietary={toggleDietary}
              mood={mood}
              onSetMood={setMood}
            />
            {envelope && (
              <p className="mt-2.5 text-[11.5px] flex items-center gap-1.5" style={bodyStyle(t)}>
                <Mail size={13} style={{ color: t.accent }} />
                <span>Bring <span style={{ fontFamily: t.accentFont, color: t.accent }}>{envelope.name}</span> to this table.</span>
              </p>
            )}
          </div>

          {/* Collapsed shortlist — render instantly, no entrance animation */}
          <div className="flex-1 overflow-y-auto py-3 min-h-0">
            <p className="text-[11px] uppercase tracking-[0.16em] mb-2" style={{ ...bodyStyle(t), color: t.descColor }}>
              Best for this table · {shortlist.length} dishes
            </p>
            <div className="flex flex-col gap-2">
              {shortlist.map(item => (
                <ShortlistRow key={item.id} item={item} onAdd={() => addItem(item)} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT pane (lg): order summary panel — sticky. Mobile: bottom footer. */}
        <div
          className="flex-shrink-0 lg:sticky lg:top-4 lg:self-start lg:my-4 mt-0"
          style={{ ...panelStyle(t), borderTop: `1.5px solid ${t.ruleColor}`, borderRadius: isHard(t) ? 0 : t.cardRadius }}
        >
          {orderItems.length > 0 && (
            <div className="px-4 pt-3 max-h-[26vh] lg:max-h-[40vh] overflow-y-auto flex flex-col gap-1.5">
              {orderItems.map(line => (
                <div key={line.lineId} className="flex items-center gap-2">
                  <span className="text-[13px] flex-1 truncate" style={{ ...bodyStyle(t), color: t.ink }}>
                    {line.item.name}
                    {line.label ? <span style={{ color: t.descColor }}> · {line.label}</span> : null}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(line.lineId, -1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ background: `${t.accent}1A`, color: t.accent, borderRadius: radius }}
                      aria-label={`Decrease ${line.item.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-[13px] w-4 text-center" style={{ ...bodyStyle(t), color: t.ink }}>{line.quantity}</span>
                    <button
                      onClick={() => updateQuantity(line.lineId, 1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ background: `${t.accent}1A`, color: t.accent, borderRadius: radius }}
                      aria-label={`Increase ${line.item.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-[13px] w-16 text-right" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {orderItems.length === 0 && (
            <p className="px-4 pt-4 text-[12px]" style={{ ...bodyStyle(t), color: t.descColor }}>
              No items yet — tap a dish to build the order.
            </p>
          )}

          {/* The one whisper line — prominent, high-contrast accent surface */}
          <AnimatePresence mode="wait">
            {whisper && (
              <motion.div
                key={whisper.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="mx-4 mt-3 p-3 flex items-center gap-2.5"
                style={{ background: t.accent, color: '#fff', borderRadius: isHard(t) ? 0 : 14 }}
              >
                <Sparkles size={16} className="flex-shrink-0" style={{ color: '#fff' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-snug" style={{ fontFamily: t.descFont }}>{whisper.text}</p>
                  <p className="text-[11px] opacity-85" style={{ fontFamily: t.descFont }}>
                    {whisper.kind === 'combo'
                      ? `${whisper.combo.itemNames.join(' · ')} · save ${formatMoney(whisper.combo.savings)}`
                      : `+${formatMoney(whisper.priceDelta)}`}
                  </p>
                </div>
                <Button variant="gold" size="sm" onClick={acceptWhisper} aria-label="Add suggestion">
                  Add
                </Button>
                <button
                  onClick={dismissWhisper}
                  className="text-[11px] px-2 py-1.5 flex-shrink-0 opacity-90 transition-opacity"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: radius, fontFamily: t.descFont }}
                >
                  No thanks
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px]" style={{ ...bodyStyle(t), color: t.descColor }}>{count} items</p>
              <span className="font-bold text-[20px] leading-none" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                <AnimatedNumber value={total} format={(v) => formatMoney(Math.round(v))} stiffness={200} damping={26} mass={0.6} />
              </span>
            </div>
            <Button variant="primary" size="md" onClick={fire} disabled={count === 0} aria-label="Fire to kitchen">
              <Send size={16} /> Fire to kitchen
            </Button>
          </div>
        </div>
      </div>

      {/* Fire confirmation — success semantics, centred above the footer */}
      <AnimatePresence>
        {fired && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute left-4 right-4 sm:left-6 sm:right-6 bottom-24 lg:bottom-6 p-4 flex items-center gap-3 shadow-xl z-10"
            style={{ background: SUCCESS_GREEN, color: '#fff', borderRadius: isHard(t) ? 0 : 16 }}
          >
            <Check size={20} className="flex-shrink-0" />
            <p className="text-[14px] font-medium" style={{ fontFamily: t.descFont, color: '#fff' }}>{fired}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ShortlistRowProps {
  item: QsrMenuItem
  onAdd: () => void
}

function ShortlistRow({ item, onAdd }: ShortlistRowProps) {
  const { tokens: t } = useTheme()
  const radius = isHard(t) ? 0 : 999
  return (
    <button
      onClick={onAdd}
      className={cn('w-full text-left p-3 flex items-center gap-3 transition-transform active:scale-[0.98]')}
      style={panelStyle(t)}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-3 h-3 rounded-[2px] flex-shrink-0"
        style={{ border: `1.5px solid ${item.isVeg ? VEG_GREEN : SPICE_RED}` }}
      >
        <span className="block w-1.5 h-1.5 rounded-full" style={{ background: item.isVeg ? VEG_GREEN : SPICE_RED }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[15px] truncate" style={{ ...sectionTitleStyle(t), color: t.ink }}>
            {item.name}
          </span>
          {item.chefsSpecial && <Sparkles size={13} style={{ color: t.accent }} />}
          {item.dietary?.includes('vegan') && <Leaf size={12} style={{ color: VEG_GREEN }} />}
          {typeof item.spiceLevel === 'number' && item.spiceLevel > 0 && (
            <span className="flex">
              {Array.from({ length: item.spiceLevel }).map((_, i) => (
                <Flame key={i} size={11} style={{ color: SPICE_RED }} />
              ))}
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5 truncate" style={{ ...bodyStyle(t), color: t.descColor }}>
          {getCategoryForItem(item.id)} ·{' '}
          <span style={{ fontFamily: t.priceFont, color: t.priceColor }}>{formatMoney(item.price)}</span>
        </p>
      </div>
      <span
        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
        style={{ background: t.accent, color: '#fff', borderRadius: radius }}
      >
        <Plus size={16} />
      </span>
    </button>
  )
}
