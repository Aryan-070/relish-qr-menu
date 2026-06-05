import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Plus, Minus, MessageSquare, CheckCircle2, Lock } from 'lucide-react'
import { type OrderItem } from '../hooks/useOrder'
import { Price } from '../components/atoms/Price'
import { AnimatedNumber } from '../components/ui/animated-number'
import { formatMoney } from '../lib/money'
import { useT } from '../i18n'
import { btnPrimary, btnIcon, btnStep } from '../animations/variants'
import type { SessionOrder } from '../lib/api/dining'

interface OrderPanelProps {
  open: boolean
  items: OrderItem[]
  total: number
  /** Orders already submitted this session (persisted) — shown read-only. */
  placedOrders?: SessionOrder[]
  /** When false, the Place Order CTA is disabled (browse-only / not allowed). */
  canPlaceOrder?: boolean
  /** Why ordering is disabled (shown under the CTA). */
  gateMessage?: string | null
  /** Transient submit error. */
  errorMessage?: string | null
  onClose: () => void
  onRemove: (lineId: string) => void
  onUpdateQty: (lineId: string, delta: number) => void
  onUpdateNote: (lineId: string, note: string) => void
  /** Commit the cart to the kitchen (scan-to-order). May be async. */
  onPlaceOrder?: () => void | Promise<void>
  /** Open the pay-at-table checkout for the current bill. */
  onCheckout?: () => void
  /** Real dining session active — show the save-your-details affordance. */
  sessionActive?: boolean
  /** Whether this device already saved contact details. */
  savedDetails?: boolean
  /** Open the save-your-details sheet. */
  onSaveDetails?: () => void
}

export function OrderPanel({
  open,
  items,
  total,
  placedOrders = [],
  canPlaceOrder = true,
  gateMessage = null,
  errorMessage = null,
  onClose,
  onRemove,
  onUpdateQty,
  onUpdateNote,
  onPlaceOrder,
  onCheckout,
  sessionActive = false,
  savedDetails = false,
  onSaveDetails,
}: OrderPanelProps) {
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [orderSent, setOrderSent] = useState(false)
  const tr = useT()

  // Placing an order must never clear the cart or hijack the waiter flow — it
  // just commits, then settles the button back. The parent decides what to clear.
  const handlePlaceOrder = async () => {
    if (!canPlaceOrder) return
    setOrderSent(true)
    try {
      await onPlaceOrder?.()
    } finally {
      setTimeout(() => setOrderSent(false), 750)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="order-backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(42,30,30,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel — explicit inline transform animation (reliable vs named variant) */}
          <motion.div
            key="order-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] sm:max-w-[560px] z-50 rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              background: 'var(--paper)',
              boxShadow: 'var(--shadow-sheet)',
              maxHeight: '88dvh',
            }}
          >
            {/* Drag handle — only this div is draggable */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 100) onClose() }}
              className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--mute)', opacity: 0.4 }} />
            </motion.div>

            {/* Header */}
            <div className="flex items-center px-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}>
              <div className="flex-1">
                <h3 className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>
                  {tr('order.title')}
                </h3>
                <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                  {items.length === 0
                    ? tr('order.nothingAdded')
                    : `${items.reduce((s, i) => s + i.quantity, 0)} ${items.reduce((s, i) => s + i.quantity, 0) !== 1 ? tr('order.itemPlural') : tr('order.itemSingular')}`}
                </p>
              </div>
              <motion.button
                whileTap={btnIcon.tap}
                onClick={onClose}
                aria-label="Close order"
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,16,36,0.08)' }}
              >
                <X size={15} style={{ color: 'var(--maroon)' }} />
              </motion.button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {/* Save-your-details (rewards + birthday) — any guest can use it. */}
              {sessionActive && onSaveDetails && (
                <button
                  type="button"
                  onClick={onSaveDetails}
                  className="w-full mb-3 px-3 py-2.5 rounded-xl text-left flex items-center justify-between"
                  style={{ background: 'rgba(217,160,58,0.12)', border: '1px solid rgba(217,160,58,0.35)' }}
                >
                  <span className="font-inter text-[12.5px]" style={{ color: 'var(--ink)' }}>
                    {savedDetails ? '✓ Your details are saved' : '🎁 Save your details for rewards & birthday treats'}
                  </span>
                  {!savedDetails && (
                    <span className="font-inter text-[11px] font-semibold" style={{ color: 'var(--maroon)' }}>Add</span>
                  )}
                </button>
              )}

              {/* Already-ordered (persisted from the dining session) */}
              {placedOrders.length > 0 && (
                <div className="mb-4">
                  <p className="font-inter text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--mute)' }}>
                    Your orders so far
                  </p>
                  <div className="flex flex-col gap-2">
                    {placedOrders.flatMap(o =>
                      o.lines.map(line => (
                        <div
                          key={`${o.id}-${line.id}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2"
                          style={{ background: 'rgba(79,122,60,0.08)', border: '1px solid rgba(79,122,60,0.25)' }}
                        >
                          <span className="font-inter text-[12.5px]" style={{ color: 'var(--ink)' }}>
                            {line.qty}× {line.item_name}
                          </span>
                          <span className="font-inter text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--mute)' }}>
                            {o.confirmation === 'pending_confirmation' ? 'awaiting server' : o.confirmation === 'confirmed' ? 'in kitchen' : o.status}
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="text-4xl opacity-30">🛍️</span>
                  <p className="font-playfair italic text-[15px]" style={{ color: 'var(--ink-soft)' }}>
                    {tr('order.empty')}
                  </p>
                  <p className="font-inter text-[12px]" style={{ color: 'var(--mute)' }}>
                    {tr('action.tapDishToAdd')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map(orderItem => {
                    const key = orderItem.lineId
                    return (
                      <motion.div
                        key={key}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          border: '1px solid rgba(217,160,58,0.25)',
                          background: 'var(--paper)',
                          boxShadow: 'var(--shadow-card)',
                        }}
                      >
                        <div className="p-3.5">
                          <div className="flex items-start gap-3">
                            {/* Qty controls */}
                            <div className="flex flex-col items-center gap-1.5 pt-0.5">
                              <motion.button
                                whileTap={btnStep.tap}
                                onClick={() => onUpdateQty(key, 1)}
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(139,16,36,0.1)' }}
                              >
                                <Plus size={12} style={{ color: 'var(--maroon)' }} />
                              </motion.button>
                              <span className="font-inter font-bold text-[15px]" style={{ color: 'var(--maroon)' }}>
                                {orderItem.quantity}
                              </span>
                              <motion.button
                                whileTap={btnStep.tap}
                                onClick={() => {
                                  if (orderItem.quantity <= 1) onRemove(key)
                                  else onUpdateQty(key, -1)
                                }}
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(139,16,36,0.1)' }}
                              >
                                <Minus size={12} style={{ color: 'var(--maroon)' }} />
                              </motion.button>
                            </div>

                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-playfair font-semibold text-[14px] leading-snug" style={{ color: 'var(--ink)' }}>
                                {orderItem.item.name}
                              </p>
                              {orderItem.label && (
                                <p className="font-inter text-[11px] mt-0.5" style={{ color: 'var(--mute)' }}>
                                  {orderItem.label}
                                </p>
                              )}
                              {/* Special note */}
                              {orderItem.note && (
                                <p className="font-inter text-[11px] mt-1 italic" style={{ color: 'var(--gold)' }}>
                                  "{orderItem.note}"
                                </p>
                              )}
                            </div>

                            {/* Price + remove */}
                            <div className="flex flex-col items-end gap-1.5">
                              <Price amount={orderItem.unitPrice * orderItem.quantity} size="sm" />
                              <motion.button
                                whileTap={{ scale: 0.82, rotate: -10, transition: { type: 'spring', stiffness: 500, damping: 24 } }}
                                onClick={() => onRemove(key)}
                              >
                                <Trash2 size={13} style={{ color: 'var(--mute)' }} />
                              </motion.button>
                            </div>
                          </div>

                          {/* Special instructions toggle */}
                          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px dashed rgba(217,160,58,0.3)' }}>
                            {noteOpen === key ? (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="flex flex-col gap-1.5"
                              >
                                <textarea
                                  autoFocus
                                  placeholder={tr('order.notePlaceholder')}
                                  value={orderItem.note ?? ''}
                                  onChange={e => onUpdateNote(key, e.target.value)}
                                  rows={2}
                                  className="w-full font-inter text-[12px] resize-none rounded-[8px] px-3 py-2 outline-none"
                                  style={{
                                    background: 'rgba(217,160,58,0.08)',
                                    border: '1px solid rgba(217,160,58,0.3)',
                                    color: 'var(--ink)',
                                  }}
                                />
                                <button
                                  onClick={() => setNoteOpen(null)}
                                  className="self-end font-inter text-[11px] font-medium"
                                  style={{ color: 'var(--maroon)' }}
                                >
                                  {tr('action.done')}
                                </button>
                              </motion.div>
                            ) : (
                              <button
                                onClick={() => setNoteOpen(key)}
                                className="flex items-center gap-1.5 font-inter text-[11px]"
                                style={{ color: orderItem.note ? 'var(--gold)' : 'var(--mute)' }}
                              >
                                <MessageSquare size={12} />
                                {orderItem.note ? tr('order.editNote') : tr('order.addNote')}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div
                className="flex-shrink-0 px-5 py-4"
                style={{ borderTop: '1.5px solid var(--gold)', background: 'var(--paper)' }}
              >
                {/* Total */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="font-inter text-[11px] uppercase tracking-widest" style={{ color: 'var(--mute)' }}>
                      {tr('order.total')}
                    </p>
                    <p className="font-playfair font-bold text-[22px]" style={{ color: 'var(--maroon)' }}>
                      <AnimatedNumber value={total} format={formatMoney} />
                    </p>
                  </div>
                  <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                    {tr('order.taxesExtra')}
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex gap-3">
                  <motion.button
                    whileTap={!orderSent && canPlaceOrder ? btnPrimary.tap : undefined}
                    onClick={handlePlaceOrder}
                    disabled={orderSent || !canPlaceOrder}
                    className="w-full py-3.5 rounded-full font-inter font-semibold text-[13.5px] relative overflow-hidden flex items-center justify-center gap-2 select-none"
                    style={{
                      background: canPlaceOrder ? 'linear-gradient(135deg, #A52030, #7A0E1E)' : 'rgba(42,30,30,0.18)',
                      color: canPlaceOrder ? '#FFF8EA' : 'var(--ink-soft)',
                      boxShadow: canPlaceOrder ? '0 4px 16px rgba(139,16,36,0.28)' : 'none',
                      minHeight: 44,
                      cursor: canPlaceOrder ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {/* ambient shimmer */}
                    {canPlaceOrder && (
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.12) 50%, transparent 80%)',
                          animation: 'shine-sweep 4s ease-in-out 0.5s infinite',
                        }}
                      />
                    )}
                    <AnimatePresence mode="wait">
                      {orderSent ? (
                        <motion.span
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                          className="flex items-center gap-2 relative z-10"
                        >
                          <CheckCircle2 size={18} />
                          <span>Sending order…</span>
                        </motion.span>
                      ) : (
                        <motion.span
                          key="label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="relative z-10 flex items-center gap-2"
                        >
                          {!canPlaceOrder && <Lock size={15} />}
                          {tr('action.placeOrder')}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
                {!canPlaceOrder && gateMessage && (
                  <p className="font-inter text-center text-[11.5px] mt-2.5" style={{ color: 'var(--ink-soft)' }}>
                    {gateMessage}
                  </p>
                )}
                {errorMessage && (
                  <p className="font-inter text-center text-[11.5px] mt-2.5" style={{ color: '#b3141b' }}>
                    {errorMessage}
                  </p>
                )}
                {onCheckout && (
                  <motion.button
                    whileTap={btnIcon.tap}
                    onClick={onCheckout}
                    className="w-full mt-2.5 py-2.5 rounded-full font-inter font-semibold text-[12.5px]"
                    style={{
                      background: 'transparent',
                      color: 'var(--maroon)',
                      border: '1.5px solid var(--maroon)',
                    }}
                  >
                    {tr('order.payBill')}
                  </motion.button>
                )}
                <p className="font-inter text-center text-[10px] mt-2" style={{ color: 'var(--mute)' }}>
                  {tr('order.handToWaiter')}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
