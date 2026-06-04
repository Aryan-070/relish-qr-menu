import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { bodyStyle, sectionTitleStyle, headingStyle, isHard } from '../../console/lib/skin'
import { formatMoney } from '../../lib/money'
import { Button } from '../../console/components/Button'
import type { OrderApi } from './types'

interface QsrOrderSheetProps {
  open: boolean
  order: OrderApi
  onClose: () => void
  /** CTA label + handler (defaults to a prototype "Place order" → clear + close). */
  ctaLabel?: string
  onCta?: () => void
  /** Force-disable the CTA (e.g. this device is browse-only this session). */
  ctaDisabled?: boolean
  /** Optional note under the total (e.g. who confirms the order). */
  ctaNote?: string
}

/**
 * The guest-facing order review: a themed bottom sheet listing every added line
 * with qty steppers + remove, the running total, and a primary CTA. Mirrors the
 * consumer OrderPanel's slide-up motion but in the Table Theory skin.
 */
export function QsrOrderSheet({
  open,
  order,
  onClose,
  ctaLabel = 'Place order',
  onCta,
  ctaDisabled = false,
  ctaNote,
}: QsrOrderSheetProps) {
  const { tokens: t } = useTheme()
  const { orderItems, updateQuantity, removeItem, total, count } = order
  const radius = isHard(t) ? 0 : 999
  const sheetRadius = isHard(t) ? 0 : 22

  const placeOrder = () => {
    if (onCta) onCta()
    else { order.clear(); onClose() }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(26,26,26,0.42)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-label="Your order"
            className="fixed inset-x-0 bottom-0 z-[61] mx-auto w-full max-w-screen-sm flex flex-col"
            style={{
              background: t.bg,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              maxHeight: '82dvh',
              boxShadow: '0 -8px 40px rgba(11,74,47,0.18)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
              <ShoppingBag size={18} style={{ color: t.accent }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em]" style={bodyStyle(t)}>Your order</p>
                <h2 className="text-[20px] leading-none" style={headingStyle(t)}>
                  {count} {count === 1 ? 'item' : 'items'}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close order"
                className="w-9 h-9 flex items-center justify-center"
                style={{ background: `${t.accent}14`, color: t.accent, borderRadius: radius }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Lines */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {orderItems.length === 0 ? (
                <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>
                  No items yet — tap a dish to start.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {orderItems.map(line => (
                    <div key={line.lineId} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold truncate" style={{ ...sectionTitleStyle(t), color: t.ink }}>
                          {line.item.name}
                        </p>
                        {line.label && (
                          <p className="text-[11px] truncate" style={bodyStyle(t)}>{line.label}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(line.lineId, -1)}
                          className="w-7 h-7 flex items-center justify-center"
                          style={{ background: `${t.accent}14`, color: t.accent, borderRadius: radius }}
                          aria-label={`Decrease ${line.item.name}`}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-[13px] w-4 text-center" style={{ ...bodyStyle(t), color: t.ink }}>{line.quantity}</span>
                        <button
                          onClick={() => updateQuantity(line.lineId, 1)}
                          className="w-7 h-7 flex items-center justify-center"
                          style={{ background: `${t.accent}14`, color: t.accent, borderRadius: radius }}
                          aria-label={`Increase ${line.item.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-[13px] w-16 text-right" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                        {formatMoney(line.unitPrice * line.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(line.lineId)}
                        className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                        style={{ color: t.inkSoft }}
                        aria-label={`Remove ${line.item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ borderTop: `1px solid ${t.ruleColor}`, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex-1">
                <p className="text-[11px]" style={bodyStyle(t)}>Total</p>
                <span className="font-bold text-[22px] leading-none" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                  {formatMoney(total)}
                </span>
                {ctaNote && (
                  <p className="text-[11px] mt-0.5" style={bodyStyle(t)}>{ctaNote}</p>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={placeOrder}
                disabled={count === 0 || ctaDisabled}
                aria-label={ctaLabel}
              >
                {ctaLabel}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
