import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Sparkles, Leaf, Flame, ShoppingBag, Tag, Mail } from 'lucide-react'
import { categories, matchesDietFilters, type QsrMenuItem, type Craving, type QsrMood, type DietFilter } from '../../data/qsrMenu'
import { formatMoney } from '../../lib/money'
import { combosForContext, useQsrWhisper, menuScore, envelopeForContext, type QsrContext } from './useQsrWhisper'
import { TastePass } from './TastePass'
import { QsrOrderSheet } from './QsrOrderSheet'
import { BillSheet } from './BillSheet'
import { cartToOrderLines } from './orderMapping'
import type { OrderApi } from './types'
import type { UseSessionResult } from '../../hooks/useSession'
import type { PublicMenuItem } from '../../lib/api/publicMenu'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, headingStyle, sectionTitleStyle, bodyStyle, isHard } from '../../console/lib/skin'
import { Button } from '../../console/components/Button'
import { AnimatedNumber } from '../../components/ui/animated-number'
import { BorderBeam } from '../../components/fx/BorderBeam'
import { SpotlightCard } from '../../components/fx/SpotlightCard'
import { fadeUp, stagger } from '../../animations/variants'
import { cn } from '../../console/lib/format'

interface GuestFastMenuProps {
  order: OrderApi
  /** Live dining session (present when reached via a `?r=&t=` QR). */
  session?: UseSessionResult
  /** Backend menu by code (== qsrMenu id), for resolving real order lines. */
  menuMap?: Map<string, PublicMenuItem>
}

const VEG_GREEN = '#2e7d4f'
const NONVEG_RED = '#c0392b'

/**
 * Customer QSR fast-menu for The Table Theory — its OWN menu (bowls, wraps,
 * sandwiches, pasta, sides, beverages, desserts; veg & non-veg), not the Relish
 * consumer catalogue. The single Jain toggle is replaced by the "Taste Pass":
 * a craving rail + dietary gate + table mood that live-reorder the grid and
 * drive a concept-aware whisper plus the brand's envelope suggestion.
 */
export function GuestFastMenu({ order, session, menuMap }: GuestFastMenuProps) {
  const { tokens: t } = useTheme()
  const { orderItems, addItem, addCombo, total, count } = order
  const [placing, setPlacing] = useState(false)
  const [placedMsg, setPlacedMsg] = useState<string | null>(null)
  // Synchronous guard so a fast double-tap can't fire two submissions before
  // the `placing` state re-render disables the button.
  const placeInFlight = useRef(false)

  // Ordering authority comes from the backend session (when present). With no
  // session (offline prototype) the cart behaves as before — anyone can place.
  const sessionActive = Boolean(session?.enabled && session.session)
  const canOrder = session?.canOrder ?? true
  const mode = session?.session?.order_confirmation_mode
  const billTotal = session?.session?.check?.total_minor ?? 0
  const ctaLabel = !sessionActive
    ? 'Place order'
    : !canOrder
      ? 'Ask your server'
      : mode === 'waiter_confirm'
        ? 'Send to server'
        : 'Place order'
  const ctaNote = sessionActive
    ? canOrder
      ? mode === 'waiter_confirm'
        ? 'Your server confirms this before the kitchen starts.'
        : undefined
      : mode === 'leader'
        ? 'Ask your server to start your order.'
        : 'Your server will confirm orders for this table.'
    : undefined

  // Real backend submission: map the cart to backend order lines and place the
  // order against the live session. Only wired when the device may order and the
  // backend menu has loaded (otherwise the sheet keeps its prototype behaviour).
  const canPlaceToBackend = sessionActive && canOrder && Boolean(menuMap)
  const flash = (msg: string) => {
    setPlacedMsg(msg)
    window.setTimeout(() => setPlacedMsg(null), 3000)
  }
  const handlePlace = async () => {
    if (!session || !menuMap || placeInFlight.current) return
    const { lines, routedToServer } = cartToOrderLines(orderItems, menuMap)
    if (lines.length === 0) {
      flash(
        routedToServer > 0
          ? 'Customised items — please ask your server to add them.'
          : 'These items aren’t available right now.',
      )
      return
    }
    placeInFlight.current = true
    setPlacing(true)
    try {
      await session.submitOrder(lines, crypto.randomUUID())
      // Clear the whole cart so submitted items can't be re-sent (double order);
      // the message tells the guest to mention any combo/customised items.
      order.clear()
      setReviewOpen(false)
      const base =
        mode === 'waiter_confirm' ? 'Sent to your server to confirm.' : 'Order placed!'
      const extra = routedToServer > 0 ? ' Ask your server about customised items.' : ''
      flash(base + extra)
    } catch {
      flash('Could not place the order — please try again.')
    } finally {
      setPlacing(false)
      placeInFlight.current = false
    }
  }

  const [cravings, setCravings] = useState<ReadonlySet<Craving>>(new Set())
  const [dietary, setDietary] = useState<ReadonlySet<DietFilter>>(new Set())
  const [mood, setMood] = useState<QsrMood | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? '')
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set())
  const [reviewOpen, setReviewOpen] = useState(false)
  const [billOpen, setBillOpen] = useState(false)

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
      // Veg and Non-veg are mutually exclusive.
      if (d === 'veg') next.delete('nonveg')
      if (d === 'nonveg') next.delete('veg')
      return next
    })
  }, [])

  const ctx: QsrContext = useMemo(() => ({ dietary, cravings, mood }), [dietary, cravings, mood])
  const combos = useMemo(() => combosForContext(ctx).slice(0, 3), [ctx])
  const cartItemIds = useMemo(() => orderItems.map(o => o.item.id), [orderItems])
  const whisper = useQsrWhisper(cartItemIds, ctx, suppressed)
  const envelope = envelopeForContext(ctx)

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) ?? categories[0],
    [activeCategoryId],
  )

  // Hard dietary gate, then soft craving/mood re-rank (stable — neutral order
  // is preserved when no preference is active).
  const visibleItems = useMemo(() => {
    const items = (activeCategory.items as QsrMenuItem[]).filter(item => matchesDietFilters(item, dietary))
    if (cravings.size === 0 && !mood) return items
    return [...items].sort((a, b) => menuScore(b, ctx) - menuScore(a, ctx))
  }, [activeCategory, dietary, cravings, mood, ctx])

  const acceptWhisper = () => {
    if (!whisper) return
    if (whisper.kind === 'combo') addCombo(whisper.combo)
    else addItem(whisper.item)
  }
  const dismissWhisper = () => { if (whisper) setSuppressed(prev => new Set(prev).add(whisper.id)) }

  const pillRadius = isHard(t) ? 0 : 999
  const priceStyle = { fontFamily: t.priceFont, color: t.priceColor }

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* Header + Taste Pass */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-3 flex flex-col gap-3">
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.18em]" style={bodyStyle(t)}>
            Sit Down. Open Up.
          </p>
          <h2 className="font-bold text-[22px] sm:text-[26px] leading-tight" style={headingStyle(t)}>
            Quick Menu
          </h2>
        </div>
        <TastePass
          cravings={cravings}
          onToggleCraving={toggleCraving}
          dietary={dietary}
          onToggleDietary={toggleDietary}
          mood={mood}
          onSetMood={setMood}
        />
      </div>

      {/* The Envelope — mood-matched card, else the generic ritual line. */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-3">
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5"
          style={{ borderRadius: t.cardRadius, background: 'rgba(143,179,154,0.16)', border: `1px solid ${t.ruleColor}` }}
        >
          <Mail size={15} className="flex-shrink-0" style={{ color: t.accent }} />
          <p className="text-[11.5px] leading-snug" style={bodyStyle(t)}>
            <span style={{ fontFamily: t.accentFont, color: t.accent }}>
              {envelope ? envelope.name : 'Today’s Theory'}
            </span>
            {' — '}
            {envelope ? envelope.line : 'a card arrives with your order. Open only after the first bite.'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-5">
        {/* Pinned combos */}
        {combos.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.16em] mb-2 flex items-center gap-1.5" style={bodyStyle(t)}>
              <Tag size={12} /> {mood ? `For the ${mood.toLowerCase()} table · save 10%` : 'Most-loved combos · save 10%'}
            </p>
            <div className="relative">
              <div className="no-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible">
                {combos.map(combo => (
                  <div
                    key={combo.id}
                    className="snap-start flex-shrink-0 w-[230px] lg:w-auto p-4 flex flex-col"
                    style={{ background: t.accent, color: '#fff', borderRadius: t.cardRadius }}
                  >
                    <p className="font-bold text-[16px] leading-tight" style={{ fontFamily: t.titleFont }}>
                      {combo.name}
                    </p>
                    <p className="text-[11px] opacity-85 mt-1 flex-1" style={{ fontFamily: t.descFont }}>
                      {combo.itemNames.join(' · ')}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <div className="min-w-0">
                        <span className="font-bold text-[18px]" style={{ fontFamily: t.priceFont }}>
                          {formatMoney(combo.comboPrice)}
                        </span>
                        <span className="text-[12px] line-through opacity-60 ml-1.5" style={{ fontFamily: t.priceFont }}>
                          {formatMoney(combo.originalPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => addCombo(combo)}
                        aria-label={`Add ${combo.name}`}
                        className="text-[12px] font-semibold px-3 py-1.5 flex-shrink-0 transition-colors"
                        style={{ background: '#fff', color: t.accent, borderRadius: pillRadius }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-10 lg:hidden"
                style={{ background: `linear-gradient(to right, transparent, ${t.bg})` }}
              />
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto snap-x pb-3 -mx-1 px-1">
          {categories.map(c => {
            const active = c.id === activeCategoryId
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategoryId(c.id)}
                aria-pressed={active}
                className="snap-start flex-shrink-0 text-[13px] font-medium px-4 py-2 transition-colors"
                style={{
                  ...bodyStyle(t),
                  borderRadius: pillRadius,
                  background: active ? t.accent : 'rgba(0,0,0,0.045)',
                  color: active ? '#fff' : t.ink,
                  border: `1px solid ${active ? t.accent : t.ruleColor}`,
                }}
              >
                {c.name}
              </button>
            )
          })}
        </div>

        {/* Dish tiles */}
        {visibleItems.length === 0 ? (
          <p className="text-[13px] py-8 text-center" style={bodyStyle(t)}>
            Nothing in this category matches your diet filter — try clearing one.
          </p>
        ) : (
          <motion.div
            key={activeCategoryId + [...cravings].join() + [...dietary].join() + mood}
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {visibleItems.map(item => (
              <GuestTile key={item.id} item={item} priceStyle={priceStyle} onAdd={() => addItem(item)} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Whisper card + cart bar */}
      <div className="flex-shrink-0" style={{ borderTop: `1px solid ${t.ruleColor}`, background: t.bg }}>
        {whisper && (
          <motion.div
            key={whisper.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-4 sm:mx-6 my-2 p-3 flex items-center gap-2.5"
            style={panelStyle(t)}
          >
            <Sparkles size={16} className="flex-shrink-0" style={{ color: t.accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium leading-snug" style={sectionTitleStyle(t)}>
                {whisper.text}
              </p>
              <p className="text-[11px]" style={bodyStyle(t)}>
                {whisper.kind === 'combo'
                  ? `save ${formatMoney(whisper.combo.savings)}`
                  : `+${formatMoney(whisper.priceDelta)}`}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={acceptWhisper} aria-label="Add suggestion">Add</Button>
            <Button variant="ghost" size="sm" onClick={dismissWhisper} aria-label="Dismiss suggestion">No</Button>
          </motion.div>
        )}

        <div className="px-4 sm:px-6 py-3 flex items-center gap-3" style={{ background: t.accent, color: '#fff' }}>
          <ShoppingBag size={20} style={{ color: '#fff' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px]" style={{ fontFamily: t.descFont, color: 'rgba(255,255,255,0.75)' }}>
              {count} {count === 1 ? 'item' : 'items'}
            </p>
            <span className="font-bold text-[18px] leading-none text-white" style={{ fontFamily: t.priceFont }}>
              <AnimatedNumber value={total} format={(v) => formatMoney(Math.round(v))} stiffness={200} damping={26} mass={0.6} />
            </span>
          </div>
          {sessionActive && billTotal > 0 && (
            <button
              aria-label="View bill"
              onClick={() => setBillOpen(true)}
              className="font-semibold text-[13px] px-4 py-2.5 flex-shrink-0 transition-transform active:scale-[0.97]"
              style={{
                background: 'rgba(255,255,255,0.16)', color: '#fff', fontFamily: t.descFont,
                borderRadius: isHard(t) ? 0 : 999,
              }}
            >
              Bill
            </button>
          )}
          <div className="relative flex-shrink-0">
            <button
              aria-label="Review order"
              onClick={() => setReviewOpen(true)}
              className="font-semibold text-[14px] px-6 py-2.5 transition-transform active:scale-[0.97]"
              style={{
                background: '#fff', color: t.accent, fontFamily: t.descFont,
                borderRadius: isHard(t) ? 0 : 999,
                textTransform: isHard(t) ? 'uppercase' : 'none',
                letterSpacing: isHard(t) ? '0.04em' : 0,
              }}
            >
              Review order
            </button>
            <BorderBeam color={t.accent} duration={5} size={1.5} />
          </div>
        </div>
      </div>

      {placedMsg && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg"
          style={{ background: t.accent, color: '#fff', fontFamily: t.descFont }}
          role="status"
        >
          {placedMsg}
        </motion.div>
      )}

      <QsrOrderSheet
        open={reviewOpen}
        order={order}
        onClose={() => setReviewOpen(false)}
        ctaLabel={placing ? 'Sending…' : ctaLabel}
        ctaDisabled={(sessionActive && !canOrder) || placing}
        ctaNote={ctaNote}
        onCta={canPlaceToBackend ? handlePlace : undefined}
      />

      {session && (
        <BillSheet open={billOpen} session={session} onClose={() => setBillOpen(false)} />
      )}
    </div>
  )
}

interface GuestTileProps {
  item: QsrMenuItem
  priceStyle: { fontFamily: string; color: string }
  onAdd: () => void
}

function GuestTile({ item, priceStyle, onAdd }: GuestTileProps) {
  const { tokens: t } = useTheme()
  return (
    <motion.div variants={fadeUp} className="h-full">
      <SpotlightCard
        color="rgba(11,74,47,0.10)"
        className="p-3 flex flex-col h-full"
        style={panelStyle(t)}
      >
        <div className="flex items-center gap-1.5 mb-1 min-h-[12px]">
          <span
            aria-hidden
            className="inline-block w-2.5 h-2.5 rounded-[2px] flex-shrink-0"
            style={{ border: `1.5px solid ${item.isVeg ? VEG_GREEN : NONVEG_RED}` }}
          >
            <span className="block w-full h-full rounded-full scale-50" style={{ background: item.isVeg ? VEG_GREEN : NONVEG_RED }} />
          </span>
          {item.chefsSpecial && <Sparkles size={12} style={{ color: t.accent }} />}
          {typeof item.spiceLevel === 'number' && item.spiceLevel > 0 && <Flame size={11} style={{ color: NONVEG_RED }} />}
          {item.dietary?.includes('vegan') && <Leaf size={11} style={{ color: VEG_GREEN }} />}
        </div>
        <p className={cn('font-semibold text-[15px] leading-tight')} style={sectionTitleStyle(t)}>
          {item.name}
        </p>
        <p className="text-[11px] mt-1 flex-1 line-clamp-2" style={bodyStyle(t)}>
          {item.description}
        </p>
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="font-bold text-[15px]" style={priceStyle}>{formatMoney(item.price)}</span>
          <button
            onClick={onAdd}
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: t.accent, color: '#fff', borderRadius: isHard(t) ? 0 : 999 }}
            aria-label={`Add ${item.name}`}
          >
            <Plus size={16} />
          </button>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}
