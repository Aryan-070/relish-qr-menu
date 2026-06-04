import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Sparkles, Leaf, Flame, ShoppingBag, Tag, Mail } from 'lucide-react'
import { categories, type MenuItem } from '../../data/menu'
import { formatMoney } from '../../lib/money'
import { combosForContext, useWhisper, type TableContext } from './useWhisper'
import type { OrderApi } from './types'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, headingStyle, sectionTitleStyle, bodyStyle, isHard } from '../../console/lib/skin'
import { Button } from '../../console/components/Button'
import { AnimatedNumber } from '../../components/ui/animated-number'
import { BorderBeam } from '../../components/fx/BorderBeam'
import { fadeUp, stagger } from '../../animations/variants'
import { cn } from '../../console/lib/format'

interface GuestFastMenuProps {
  order: OrderApi
}

const JAIN_GREEN = '#2e7d32'
const SPICE_RED = '#c0392b'

/**
 * Customer QSR fast-menu — a faster, tile-first way to present the menu than the
 * cinematic landing. Combos are pinned on top, every dish is one tap to add, and
 * the same whisper engine surfaces a single upsell card above the cart. Fully
 * theme-aware (warm / hybrid / brutalist / editorial) via the shared skin tokens.
 */
export function GuestFastMenu({ order }: GuestFastMenuProps) {
  const { tokens: t } = useTheme()
  const { orderItems, addItem, addCombo, total, count } = order

  const [jainOnly, setJainOnly] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? '')
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set())

  const ctx: TableContext = useMemo(() => ({ mood: null, partySize: null, jainOnly }), [jainOnly])
  const combos = useMemo(() => combosForContext(ctx).slice(0, 3), [ctx])
  const cartItemIds = useMemo(() => orderItems.map(o => o.item.id), [orderItems])
  const whisper = useWhisper(cartItemIds, ctx, suppressed)

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) ?? categories[0],
    [activeCategoryId],
  )

  const visibleItems = useMemo(
    () => activeCategory.items.filter(item => !jainOnly || item.isJain),
    [activeCategory, jainOnly],
  )

  const acceptWhisper = () => {
    if (!whisper) return
    if (whisper.kind === 'combo') addCombo(whisper.combo)
    else addItem(whisper.item)
  }
  const dismissWhisper = () => {
    if (whisper) setSuppressed(prev => new Set(prev).add(whisper.id))
  }

  const pillRadius = isHard(t) ? 0 : 999
  const priceStyle = { fontFamily: t.priceFont, color: t.priceColor }

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      {/* Header + Jain toggle */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-[0.18em]" style={bodyStyle(t)}>
            Sit Down. Open Up.
          </p>
          <h2 className="font-bold text-[22px] sm:text-[26px] leading-tight" style={headingStyle(t)}>
            Quick Menu
          </h2>
        </div>
        <button
          onClick={() => setJainOnly(v => !v)}
          aria-pressed={jainOnly}
          className="text-[12px] font-medium px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0 transition-colors"
          style={{
            ...bodyStyle(t),
            borderRadius: pillRadius,
            background: jainOnly ? JAIN_GREEN : 'rgba(46,125,50,0.12)',
            color: jainOnly ? '#fff' : JAIN_GREEN,
            border: `1px solid ${jainOnly ? JAIN_GREEN : 'rgba(46,125,50,0.3)'}`,
          }}
        >
          <Leaf size={13} /> Jain
        </button>
      </div>

      {/* The Envelope — the brand's signature ritual, surfaced as a quiet note. */}
      <div className="flex-shrink-0 px-4 sm:px-6 pb-3">
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5"
          style={{
            borderRadius: t.cardRadius,
            background: 'rgba(143,179,154,0.16)',
            border: `1px solid ${t.ruleColor}`,
          }}
        >
          <Mail size={15} className="flex-shrink-0" style={{ color: t.accent }} />
          <p className="text-[11.5px] leading-snug" style={bodyStyle(t)}>
            <span style={{ fontFamily: t.accentFont, color: t.accent }}>Today’s Theory</span>
            {' '}— a card arrives with your order. Open only after the first bite.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-5">
        {/* Pinned combos */}
        {combos.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.16em] mb-2 flex items-center gap-1.5" style={bodyStyle(t)}>
              <Tag size={12} /> Most-loved combos · save 10%
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
              {/* Right-edge fade so cards don't hard-clip (mobile/tablet only) */}
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
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {visibleItems.map(item => (
            <GuestTile key={item.id} item={item} priceStyle={priceStyle} onAdd={() => addItem(item)} />
          ))}
        </motion.div>
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
            <Button variant="primary" size="sm" onClick={acceptWhisper} aria-label="Add suggestion">
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={dismissWhisper} aria-label="Dismiss suggestion">
              No
            </Button>
          </motion.div>
        )}

        <div
          className="px-4 sm:px-6 py-3 flex items-center gap-3"
          style={{ background: t.accent, color: '#fff' }}
        >
          <ShoppingBag size={20} style={{ color: '#fff' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px]" style={{ fontFamily: t.descFont, color: 'rgba(255,255,255,0.75)' }}>
              {count} {count === 1 ? 'item' : 'items'}
            </p>
            <span className="font-bold text-[18px] leading-none text-white" style={{ fontFamily: t.priceFont }}>
              <AnimatedNumber
                value={total}
                format={(v) => formatMoney(Math.round(v))}
                stiffness={200}
                damping={26}
                mass={0.6}
              />
            </span>
          </div>
          <div className="relative flex-shrink-0">
            <button
              aria-label="Review order"
              className="font-semibold text-[14px] px-6 py-2.5 transition-transform active:scale-[0.97]"
              style={{
                background: '#fff',
                color: t.accent,
                fontFamily: t.descFont,
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
    </div>
  )
}

interface GuestTileProps {
  item: MenuItem
  priceStyle: { fontFamily: string; color: string }
  onAdd: () => void
}

function GuestTile({ item, priceStyle, onAdd }: GuestTileProps) {
  const { tokens: t } = useTheme()
  return (
    <motion.div variants={fadeUp} className="p-3 flex flex-col" style={panelStyle(t)}>
      <div className="flex items-center gap-1 mb-1 min-h-[12px]">
        {item.chefsSpecial && <Sparkles size={12} style={{ color: t.accent }} />}
        {item.isJain && <Leaf size={11} style={{ color: JAIN_GREEN }} />}
        {typeof item.spiceLevel === 'number' && item.spiceLevel > 0 && <Flame size={11} style={{ color: SPICE_RED }} />}
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
    </motion.div>
  )
}
