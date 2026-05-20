import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ShoppingBag } from 'lucide-react'
import { type MenuItem, getItemById, getCategoryForItem } from '../data/menu'
import { Badge } from '../components/atoms/Badge'
import { Price } from '../components/atoms/Price'
import { Button } from '../components/atoms/Button'
import { CategoryIllustration } from '../components/atoms/CategoryIllustration'
import { bottomSheet, stagger, fadeUp } from '../animations/variants'

interface ItemDetailProps {
  item: MenuItem | null
  onClose: () => void
  onAddToOrder: (item: MenuItem, customization: string) => void
  onWaiter: () => void
}

export function ItemDetail({ item, onClose, onAddToOrder, onWaiter }: ItemDetailProps) {
  const [selectedCustomization, setSelectedCustomization] = useState('Regular')

  // Reset customization whenever a new item opens
  useEffect(() => {
    if (item) {
      setSelectedCustomization(item.customizations[0] ?? 'Regular')
    }
  }, [item?.id])

  const handleAdd = () => {
    if (!item) return
    onAddToOrder(item, selectedCustomization)
  }

  const handleAddPairing = (paired: MenuItem) => {
    onAddToOrder(paired, paired.customizations[0] ?? 'Regular')
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

          {/* Sheet — NOT draggable itself; only the handle drags */}
          <motion.div
            key="sheet"
            variants={bottomSheet}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] rounded-t-3xl"
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
              className="absolute top-3.5 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
              style={{ background: 'rgba(139,16,36,0.08)' }}
            >
              <X size={16} style={{ color: 'var(--maroon)' }} />
            </button>

            {/* Scrollable content — independent of drag */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pb-8">
                {/* Image */}
                <motion.div
                  initial={{ scale: 0.97, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mb-4 mt-1"
                >
                  <CategoryIllustration categoryId={getCategoryForItem(item.id)} className="aspect-[4/3]" />
                </motion.div>

                {/* Title + price */}
                <div className="flex items-start justify-between mb-1">
                  <h2
                    className="font-playfair font-bold text-[22px] leading-tight flex-1 pr-4"
                    style={{ color: 'var(--maroon)' }}
                  >
                    {item.name}
                  </h2>
                  <Price amount={item.price} size="lg" />
                </div>

                {/* Badges */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {item.isJain && <Badge variant="jain">Jain</Badge>}
                  {item.canBeJain && !item.isJain && <Badge variant="jain">Can be Jain</Badge>}
                  {item.tags.map(tag => (
                    <Badge key={tag} variant="tag">{tag}</Badge>
                  ))}
                </div>

                {/* Description */}
                <p
                  className="font-inter text-[13px] leading-relaxed mb-4"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {item.description}
                </p>

                <div className="gold-divider" />

                {/* Customisations */}
                <div className="mb-4">
                  <p
                    className="font-inter text-[11px] uppercase tracking-widest mb-2"
                    style={{ color: 'var(--gold)' }}
                  >
                    Customise
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.customizations.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCustomization(c)}
                        className="px-3 py-1.5 rounded-full font-inter text-[12px] border transition-all"
                        style={{
                          background: selectedCustomization === c ? 'var(--maroon)' : 'transparent',
                          color: selectedCustomization === c ? 'white' : 'var(--ink-soft)',
                          borderColor: selectedCustomization === c ? 'var(--maroon)' : 'rgba(139,16,36,0.25)',
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goes well with */}
                {Object.values(item.pairings).some(Boolean) && (
                  <>
                    <div className="gold-divider" />
                    <div className="mb-4">
                      <p
                        className="font-inter text-[11px] uppercase tracking-widest mb-2"
                        style={{ color: 'var(--gold)' }}
                      >
                        Goes well with
                      </p>
                      <p
                        className="font-inter text-[11px] mb-3"
                        style={{ color: 'var(--mute)' }}
                      >
                        Tap to add to your order
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
                  <Button variant="primary" fullWidth onClick={handleAdd}>
                    <ShoppingBag size={14} /> Add to Order
                  </Button>
                  <Button variant="ghost" onClick={() => { onClose(); setTimeout(onWaiter, 80) }}>
                    Ask Waiter
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
