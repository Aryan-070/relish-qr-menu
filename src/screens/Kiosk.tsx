import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, X, Utensils } from 'lucide-react'
import { categories, getCategoryForItem, type MenuItem } from '../data/menu'
import { useOrder } from '../hooks/useOrder'
import { Checkout } from './Checkout'
import { formatMoney } from '../lib/money'
import { AnimatedNumber } from '../components/ui/animated-number'
import { useOpsStore } from '../console/store/useOpsStore'
import { resolveGuestTableId } from '../lib/tableSession'
import { type OrderRecord, type OrderLine } from '../console/lib/types'

// Kiosk runs at a fixed station/table — read the QR `?t=` param like the guest
// flow, falling back to a demo table.
const KIOSK_TABLE_ID = resolveGuestTableId()

/**
 * Kiosk — full-screen self-order layout (Flipdish-style). Reuses the guest
 * `useOrder` cart, the shared `categories` menu data, and the existing
 * `Checkout` sheet for payment. Large-format category tabs + dish grid on the
 * left, a persistent cart rail on the right.
 *
 * Activated via `?kiosk=1` in App.tsx; guest/staff flows are untouched.
 */
export function Kiosk() {
  const { orderItems, addItem, removeItem, updateQuantity, clear, total, count } = useOrder()
  const ops = useOpsStore()

  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id ?? '')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) ?? categories[0],
    [activeCategoryId],
  )

  const reference = lastOrderId ?? `KIOSK-${KIOSK_TABLE_ID}`

  // Commit the kiosk cart to the shared ops store so it surfaces on the floor
  // and the kitchen display — mirrors App.tsx handlePlaceOrder.
  const commitOrder = (): string => {
    const lines: OrderLine[] = orderItems.map(o => ({
      itemId: o.item.id,
      name: o.item.name,
      price: o.unitPrice,
      qty: o.quantity,
      categoryId: getCategoryForItem(o.item.id) || 'combo',
      modifiers: o.label || undefined,
      note: o.note,
    }))
    const seatedTable = ops.state.tables.find(t => t.id === KIOSK_TABLE_ID)
    const orderId = `ORD-${String(Date.now()).slice(-6)}`
    const order: OrderRecord = {
      id: orderId,
      tableId: KIOSK_TABLE_ID,
      waiterId: seatedTable?.waiterId ?? '',
      placedAt: Date.now(),
      lines,
      total,
      paid: false,
      status: 'new',
      source: 'guest',
    }
    ops.placeOrder(order)
    setLastOrderId(orderId)
    return orderId
  }

  const handleOpenCheckout = () => {
    if (orderItems.length === 0) return
    commitOrder()
    setCheckoutOpen(true)
  }

  // Payment succeeded: mark the table paid, clear the cart, flash a thank-you,
  // then reset for the next guest at the kiosk.
  const handlePaid = () => {
    const ref = lastOrderId
    ops.payTables([KIOSK_TABLE_ID])
    clear()
    setCheckoutOpen(false)
    setConfirmation(ref)
    window.setTimeout(() => {
      setConfirmation(null)
      setLastOrderId(null)
    }, 4200)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--paper)' }}
      data-kiosk="1"
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: '1.5px solid var(--gold)', background: 'var(--paper)' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--maroon)' }}
        >
          <Utensils size={20} color="#FFF8EA" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-playfair font-bold text-[22px] leading-none" style={{ color: 'var(--maroon)' }}>
            Relish
          </h1>
          <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--mute)' }}>
            Tap to order · Pay here · Table {KIOSK_TABLE_ID}
          </p>
        </div>
      </header>

      {/* Body: menu (left) + cart rail (right) */}
      <div className="flex-1 flex min-h-0">
        {/* Menu column */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* Category tabs */}
          <nav
            className="flex-shrink-0 flex gap-2 px-6 py-4 overflow-x-auto"
            style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}
          >
            {categories.map(c => {
              const active = c.id === activeCategory?.id
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className="flex-shrink-0 px-5 py-2.5 rounded-full font-inter text-[14px] font-medium transition-colors"
                  style={{
                    background: active ? 'var(--maroon)' : 'rgba(139,16,36,0.08)',
                    color: active ? '#FFF8EA' : 'var(--maroon)',
                  }}
                >
                  {c.name}
                </button>
              )
            })}
          </nav>

          {/* Dish grid */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCategory?.items.map(item => (
                <KioskDishCard key={item.id} item={item} onAdd={() => addItem(item)} />
              ))}
            </div>
          </div>
        </section>

        {/* Cart rail */}
        <aside
          className="flex-shrink-0 w-[300px] sm:w-[360px] flex flex-col"
          style={{ borderLeft: '1.5px solid var(--gold)', background: 'var(--paper-soft, var(--paper))' }}
        >
          <div
            className="flex-shrink-0 flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}
          >
            <ShoppingBag size={18} style={{ color: 'var(--maroon)' }} />
            <h2 className="font-playfair font-bold text-[17px] flex-1" style={{ color: 'var(--maroon)' }}>
              Your Order
            </h2>
            {count > 0 && (
              <button
                onClick={clear}
                className="font-inter text-[12px] flex items-center gap-1"
                style={{ color: 'var(--mute)' }}
                aria-label="Clear order"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {orderItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
                <ShoppingBag size={32} style={{ color: 'var(--gold)', opacity: 0.5 }} />
                <p className="font-inter text-[13px]" style={{ color: 'var(--mute)' }}>
                  Your cart is empty.
                </p>
                <p className="font-inter text-[12px]" style={{ color: 'var(--mute)' }}>
                  Tap a dish to add it.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {orderItems.map(o => (
                  <motion.div
                    key={o.lineId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-playfair text-[14px] leading-tight truncate" style={{ color: 'var(--ink)' }}>
                        {o.item.name}
                      </p>
                      {o.label && (
                        <p className="font-inter text-[11px] truncate" style={{ color: 'var(--mute)' }}>
                          {o.label}
                        </p>
                      )}
                      <p className="font-inter text-[12px] mt-0.5" style={{ color: 'var(--maroon)' }}>
                        {formatMoney(o.unitPrice * o.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => (o.quantity > 1 ? updateQuantity(o.lineId, -1) : removeItem(o.lineId))}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(139,16,36,0.08)' }}
                        aria-label="Decrease quantity"
                      >
                        {o.quantity > 1 ? (
                          <Minus size={13} style={{ color: 'var(--maroon)' }} />
                        ) : (
                          <Trash2 size={13} style={{ color: 'var(--maroon)' }} />
                        )}
                      </button>
                      <span
                        className="font-inter text-[13px] font-semibold w-5 text-center"
                        style={{ color: 'var(--ink)' }}
                      >
                        {o.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(o.lineId, 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--maroon)' }}
                        aria-label="Increase quantity"
                      >
                        <Plus size={13} color="#FFF8EA" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer: total + checkout */}
          <div
            className="flex-shrink-0 px-5 py-4"
            style={{ borderTop: '1.5px solid var(--gold)' }}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="font-inter text-[12px] uppercase tracking-widest" style={{ color: 'var(--mute)' }}>
                Subtotal
              </p>
              <p className="font-playfair font-bold text-[22px]" style={{ color: 'var(--maroon)' }}>
                <AnimatedNumber value={total} format={formatMoney} />
              </p>
            </div>
            <motion.button
              whileTap={count > 0 ? { scale: 0.97 } : undefined}
              onClick={handleOpenCheckout}
              disabled={count === 0}
              className="w-full py-3.5 rounded-full font-inter font-semibold text-[15px] flex items-center justify-center gap-2 select-none disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #A52030, #7A0E1E)',
                color: '#FFF8EA',
                boxShadow: '0 4px 16px rgba(139,16,36,0.28)',
                minHeight: 52,
              }}
            >
              {count > 0 ? `Checkout · ${count} ${count === 1 ? 'item' : 'items'}` : 'Add items to order'}
              {count > 0 && <ArrowRight size={17} />}
            </motion.button>
          </div>
        </aside>
      </div>

      {/* Shared payment sheet */}
      <Checkout
        open={checkoutOpen}
        items={orderItems}
        subtotal={total}
        reference={reference}
        onClose={() => setCheckoutOpen(false)}
        onPaid={handlePaid}
        onAddUpsell={(item) => addItem(item)}
      />

      {/* Post-payment thank-you overlay — resets for the next guest */}
      <AnimatePresence>
        {confirmation && (
          <motion.div
            key="kiosk-thanks"
            className="fixed inset-0 z-[60] flex items-center justify-center px-6"
            style={{ background: 'rgba(42,30,30,0.72)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setConfirmation(null); setLastOrderId(null) }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[420px] rounded-3xl px-8 py-10 text-center"
              style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-sheet)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setConfirmation(null); setLastOrderId(null) }}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,16,36,0.08)' }}
              >
                <X size={15} style={{ color: 'var(--maroon)' }} />
              </button>
              <div
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--maroon)' }}
              >
                <Utensils size={28} color="#FFF8EA" />
              </div>
              <h2 className="font-playfair font-bold text-[24px]" style={{ color: 'var(--maroon)' }}>
                Thank you!
              </h2>
              <p className="font-inter text-[13.5px] mt-2" style={{ color: 'var(--ink)' }}>
                Your order is on its way to the kitchen.
              </p>
              {confirmation && (
                <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--mute)' }}>
                  Reference {confirmation}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface KioskDishCardProps {
  item: MenuItem
  onAdd: () => void
}

/** Large-format menu tile with a tap-to-add affordance. */
function KioskDishCard({ item, onAdd }: KioskDishCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onAdd}
      className="flex flex-col text-left rounded-2xl overflow-hidden p-4 h-full"
      style={{
        border: '1px solid rgba(217,160,58,0.3)',
        background: 'rgba(217,160,58,0.05)',
      }}
    >
      <div className="flex items-start gap-2">
        <h3 className="flex-1 font-playfair font-semibold text-[15.5px] leading-tight" style={{ color: 'var(--ink)' }}>
          {item.name}
        </h3>
        {item.chefsSpecial && (
          <span
            className="flex-shrink-0 font-inter text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: 'var(--gold)', color: '#2A1E1E' }}
          >
            Chef's
          </span>
        )}
      </div>
      <p className="font-inter text-[11.5px] mt-1.5 line-clamp-2 flex-1" style={{ color: 'var(--mute)' }}>
        {item.description}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="font-playfair font-bold text-[15px]" style={{ color: 'var(--maroon)' }}>
          {formatMoney(item.price)}
        </span>
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--maroon)' }}
        >
          <Plus size={16} color="#FFF8EA" />
        </span>
      </div>
    </motion.button>
  )
}
