import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ShoppingBag } from 'lucide-react'
import { type MenuItem, getItemById, getCategoryForItem } from '../data/menu'
import { dietaryProfile, ALLERGEN_LABELS, type DietaryTag } from '../data/dietary'
import {
  resolveModifierGroups,
  defaultSelection,
  selectionUnitPrice,
  isSelectionValid,
  type SelectedModifier,
  type ModifierGroup,
  type ModifierOption,
} from '../data/modifiers'
import { ChefSpecial, SpiceLevel, DietBadge, TagLabel } from '../components/atoms/DietaryBadges'
import { formatMoney } from '../lib/money'
import { useT } from '../i18n'
import { Price } from '../components/atoms/Price'
import { Button } from '../components/atoms/Button'
import { CategoryIllustration } from '../components/atoms/CategoryIllustration'
import { LqipVideo } from '../components/atoms/LqipVideo'
import { stagger, fadeUp } from '../animations/variants'
import { useTheme } from '../theme/ThemeContext'
import { useMediaMode } from '../theme/MediaModeContext'
import { resolveDishHeroVideo } from '../data/videoManifest'

interface ItemDetailProps {
  item: MenuItem | null
  onClose: () => void
  onAddToOrder: (item: MenuItem, modifiers: SelectedModifier[]) => void
  onWaiter: () => void
}

export function ItemDetail({ item, onClose, onAddToOrder, onWaiter }: ItemDetailProps) {
  const { tokens: t } = useTheme()
  const tr = useT()
  const { posterOnly } = useMediaMode()
  const [selection, setSelection] = useState<SelectedModifier[]>([])
  const [heroErr, setHeroErr] = useState(false)
  const handleHeroErr = useCallback(() => setHeroErr(true), [])

  const groups = useMemo(() => (item ? resolveModifierGroups(item) : []), [item])

  // Reset selection + image error whenever a new item opens
  const itemId = item?.id
  useEffect(() => {
    if (item) {
      setSelection(defaultSelection(resolveModifierGroups(item)))
      setHeroErr(false)
    }
  }, [itemId]) // eslint-disable-line react-hooks/exhaustive-deps

  const unitPrice = item ? selectionUnitPrice(item.price, selection) : 0
  const valid = isSelectionValid(groups, selection)

  const toggleOption = (group: ModifierGroup, option: ModifierOption) => {
    setSelection(prev => {
      const others = prev.filter(s => s.groupId !== group.id)
      const inGroup = prev.filter(s => s.groupId === group.id)
      const isSelected = inGroup.some(s => s.optionId === option.id)
      const sel: SelectedModifier = {
        groupId: group.id,
        optionId: option.id,
        label: option.label,
        priceDelta: option.priceDelta,
      }
      // Single-select (radio): replace whatever was chosen in the group
      if (group.max === 1) return [...others, sel]
      // Multi-select toggle, respecting min/max
      if (isSelected) {
        const next = inGroup.filter(s => s.optionId !== option.id)
        if (next.length < group.min) return prev
        return [...others, ...next]
      }
      if (inGroup.length >= group.max) return prev
      return [...others, ...inGroup, sel]
    })
  }

  const handleAdd = () => {
    if (!item || !valid) return
    onAddToOrder(item, selection)
  }

  const handleAddPairing = (paired: MenuItem) => {
    onAddToOrder(paired, defaultSelection(resolveModifierGroups(paired)))
  }

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(42,30,30,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet — NOT draggable itself; only the handle drags.
              Explicit inline transform animation (reliable vs named variant). */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed bottom-0 inset-x-0 mx-auto z-50 w-full max-w-[480px] sm:max-w-[560px] rounded-t-3xl"
            style={{
              background: 'var(--paper)',
              boxShadow: 'var(--shadow-sheet)',
              maxHeight: '90dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle — only this element is draggable */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80) onClose()
              }}
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing flex-shrink-0"
            >
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--mute)', opacity: 0.5 }}
              />
            </motion.div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3.5 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
              style={{ background: 'rgba(139,16,36,0.08)' }}
            >
              <X size={16} style={{ color: 'var(--maroon)' }} />
            </button>

            {/* Scrollable content — independent of drag */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pb-8">
                {/* Hero image — real photo with SVG illustration fallback */}
                <motion.div
                  initial={{ scale: 0.97, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mb-4 mt-1"
                >
                  {!heroErr ? (
                    <LqipVideo
                      key={item.id}
                      renditions={resolveDishHeroVideo(item).renditions}
                      poster={resolveDishHeroVideo(item).poster}
                      alt={item.name}
                      posterOnly={posterOnly}
                      play="visible"
                      wrapperClassName="w-full aspect-[4/3] rounded-2xl"
                      wrapperStyle={{ border: '1px solid rgba(217,160,58,0.2)' }}
                      videoClassName="w-full h-full object-cover"
                      onError={handleHeroErr}
                    />
                  ) : (
                    <CategoryIllustration categoryId={getCategoryForItem(item.id)} className="aspect-[4/3]" />
                  )}
                </motion.div>

                {/* Title + price */}
                <div className="flex items-start justify-between mb-1">
                  <h2
                    className="font-bold leading-tight flex-1 pr-4"
                    style={{
                      fontFamily: t.headerFont,
                      textTransform: t.headerTransform,
                      fontSize: 23,
                      letterSpacing: t.headerSpacing,
                      color: t.headerColor,
                    }}
                  >
                    {item.name}
                  </h2>
                  <Price amount={item.price} size="lg" />
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {item.chefsSpecial && <ChefSpecial theme={t} />}
                  {item.isJain && <DietBadge label="Jain" theme={t} />}
                  {item.canBeJain && !item.isJain && <DietBadge label="Can be Jain" theme={t} />}
                  {item.spiceLevel ? <SpiceLevel level={item.spiceLevel} theme={t} /> : null}
                  {item.tags.map(tag => (
                    <TagLabel key={tag} label={tag} theme={t} />
                  ))}
                </div>

                {/* Description */}
                <p
                  className="font-inter text-[13px] leading-relaxed mb-4"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {item.description}
                </p>

                {/* Dietary + allergen disclosure */}
                <DietaryDisclosure item={item} />

                <div className="gold-divider" />

                {/* Modifier groups (priced, with min/max rules) */}
                {groups.map(group => {
                  const inGroup = selection.filter(s => s.groupId === group.id)
                  const rule =
                    group.max === 1
                      ? tr('item.pickOne')
                      : group.min > 0
                        ? `Choose ${group.min}–${group.max}`
                        : `Up to ${group.max}`
                  return (
                    <div className="mb-4" key={group.id}>
                      <div className="flex items-baseline justify-between mb-2">
                        <p
                          className="font-inter text-[11px] uppercase tracking-widest"
                          style={{ color: 'var(--gold)' }}
                        >
                          {group.name}
                        </p>
                        <span className="font-inter text-[10px]" style={{ color: 'var(--mute)' }}>
                          {rule}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map(option => {
                          const isSelected = inGroup.some(s => s.optionId === option.id)
                          return (
                            <button
                              key={option.id}
                              onClick={() => toggleOption(group, option)}
                              className="px-3 py-1.5 rounded-full font-inter text-[12px] border transition-all flex items-center gap-1.5"
                              style={{
                                background: isSelected ? 'var(--maroon)' : 'transparent',
                                color: isSelected ? 'white' : 'var(--ink-soft)',
                                borderColor: isSelected ? 'var(--maroon)' : 'rgba(139,16,36,0.25)',
                              }}
                            >
                              {option.label}
                              {option.priceDelta > 0 && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    opacity: isSelected ? 0.85 : 0.7,
                                    color: isSelected ? 'white' : 'var(--gold)',
                                  }}
                                >
                                  +{formatMoney(option.priceDelta)}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Goes well with */}
                {Object.values(item.pairings).some(Boolean) && (
                  <>
                    <div className="gold-divider" />
                    <div className="mb-4">
                      <p
                        className="font-inter text-[11px] uppercase tracking-widest mb-2"
                        style={{ color: 'var(--gold)' }}
                      >
                        {tr('item.goesWellWith')}
                      </p>
                      <p
                        className="font-inter text-[11px] mb-3"
                        style={{ color: 'var(--mute)' }}
                      >
                        {tr('action.tapToAdd')}
                      </p>
                      <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-col gap-2"
                      >
                        {Object.entries(item.pairings)
                          .filter(([, id]) => id)
                          .map(([type, id]) => {
                            const paired = getItemById(id!)
                            if (!paired) return null
                            const label = type === 'beverage' ? 'Drink' : type === 'side' ? 'Side' : 'Dessert'
                            return (
                              <motion.button
                                key={type}
                                variants={fadeUp}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleAddPairing(paired)}
                                className="flex items-center justify-between px-3.5 py-3 rounded-2xl w-full text-left transition-all"
                                style={{
                                  background: 'rgba(217,160,58,0.08)',
                                  border: '1px solid rgba(217,160,58,0.3)',
                                }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="font-inter text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
                                    style={{ background: 'rgba(217,160,58,0.15)', color: 'var(--gold)' }}
                                  >
                                    {label}
                                  </span>
                                  <span className="font-inter text-[13px] truncate" style={{ color: 'var(--ink)' }}>
                                    {paired.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <Price amount={paired.price} size="sm" />
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{ background: 'var(--maroon)' }}
                                  >
                                    <Plus size={11} color="white" />
                                  </div>
                                </div>
                              </motion.button>
                            )
                          })}
                      </motion.div>
                    </div>
                  </>
                )}

                <div className="gold-divider" />

                {/* CTAs */}
                <div className="flex gap-3 mt-4">
                  <Button variant="primary" fullWidth onClick={handleAdd} disabled={!valid}>
                    <ShoppingBag size={14} /> {tr('action.addToOrder')} · {formatMoney(unitPrice)}
                  </Button>
                  <Button variant="ghost" onClick={() => { onClose(); setTimeout(onWaiter, 80) }}>
                    {tr('action.askWaiter')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Positive dietary claims worth surfacing to the guest (vegetarian is implicit
// on this menu, so it's omitted to reduce noise).
const DIETARY_DISPLAY: ReadonlyArray<[DietaryTag, string]> = [
  ['vegan', 'Vegan'],
  ['jain', 'Jain'],
  ['gluten-free', 'Gluten-free'],
  ['nut-free', 'Nut-free'],
  ['dairy-free', 'Dairy-free'],
]

function DietaryDisclosure({ item }: { item: MenuItem }) {
  const tr = useT()
  const { dietary, allergens } = dietaryProfile(item)
  const claims = DIETARY_DISPLAY.filter(([tag]) => dietary.includes(tag))
  if (claims.length === 0 && allergens.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-2">
      {claims.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-inter text-[10px] uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
            {tr('item.suitableFor')}
          </span>
          {claims.map(([tag, label]) => (
            <span
              key={tag}
              className="font-inter text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(79,122,60,0.12)', color: '#4F7A3C', border: '1px solid rgba(79,122,60,0.4)' }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {allergens.length > 0 && (
        <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
          <span style={{ fontWeight: 600, color: 'var(--maroon)' }}>{tr('item.contains')}:</span>{' '}
          {allergens.map(a => ALLERGEN_LABELS[a]).join(' · ')}
          <span style={{ opacity: 0.7 }}> — {tr('item.allergyNote')}</span>
        </p>
      )}
    </div>
  )
}
