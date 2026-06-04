import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, CheckCircle2, Plus, Loader2 } from 'lucide-react'
import { type OrderItem } from '../hooks/useOrder'
import { categories, type MenuItem } from '../data/menu'
import { computeTotals, withTip, TAX_RATE } from '../console/views/waiter/billing'
import { splitGst } from '../lib/tax'
import { splitEvenly } from '../lib/split'
import { formatMoney } from '../lib/money'
import { getPaymentGateway } from '../lib/payments'
import { isRazorpayConfigured } from '../console/lib/razorpay'
import { AnimatedNumber } from '../components/ui/animated-number'
import { useT } from '../i18n'
import { btnPrimary, btnIcon } from '../animations/variants'

interface CheckoutProps {
  open: boolean
  items: OrderItem[]
  subtotal: number
  /** Reference id for the payment (the placed order id, or a synthesized one). */
  reference: string
  customerEmail?: string
  onClose: () => void
  /** Called once payment succeeds — caller marks the order paid + routes to feedback. */
  onPaid: () => void
  /** Add an upsell dish to the cart (sweet/drink suggestions). */
  onAddUpsell?: (item: MenuItem) => void
}

const TIP_PRESETS = [0, 5, 10, 15] as const
const SPLIT_OPTIONS = [1, 2, 3, 4] as const
type PayState = 'idle' | 'processing' | 'paid' | 'failed' | 'dismissed'

/** Two dessert/sweet suggestions not already in the cart, for a checkout upsell. */
function pickUpsells(items: OrderItem[]): MenuItem[] {
  const inCart = new Set(items.map(o => o.item.id))
  const sweet = categories.find(c => /dessert/i.test(c.name)) ?? categories[categories.length - 1]
  return sweet.items.filter(i => !inCart.has(i.id)).slice(0, 2)
}

export function Checkout({
  open,
  items,
  subtotal,
  reference,
  customerEmail,
  onClose,
  onPaid,
  onAddUpsell,
}: CheckoutProps) {
  const tr = useT()
  const [tipPct, setTipPct] = useState(0)
  const [ways, setWays] = useState(1)
  const [payState, setPayState] = useState<PayState>('idle')

  const totals = useMemo(() => computeTotals(subtotal, 0), [subtotal])
  const tipAmount = useMemo(() => Math.round(totals.total * (tipPct / 100)), [totals.total, tipPct])
  const grandTotal = useMemo(() => withTip(totals, tipAmount).grandTotal, [totals, tipAmount])
  const gst = useMemo(() => splitGst(totals.tax, TAX_RATE * 100, false), [totals.tax])
  const perPerson = useMemo(
    () => (ways > 1 ? splitEvenly(grandTotal, ways) : null),
    [grandTotal, ways],
  )
  const upsells = useMemo(() => (onAddUpsell ? pickUpsells(items) : []), [items, onAddUpsell])

  const handlePay = async () => {
    if (payState === 'processing' || payState === 'paid') return
    setPayState('processing')
    try {
      const gateway = getPaymentGateway()
      const result = await gateway.pay({
        amount: grandTotal,
        currency: 'INR',
        reference,
        description: `Relish — table bill (${tr('checkout.title')})`,
        customerEmail,
      })
      if (result.status === 'paid') {
        setPayState('paid')
        window.setTimeout(() => {
          onPaid()
          setPayState('idle')
          setTipPct(0)
          setWays(1)
        }, 1100)
      } else {
        setPayState(result.status === 'dismissed' ? 'dismissed' : 'failed')
      }
    } catch {
      // A conforming gateway resolves rather than rejects, but resolving the
      // gateway or an unexpected provider error could still throw. Route that
      // to the (already-rendered) retryable "failed" state instead of leaving
      // the button stuck on "processing" forever.
      setPayState('failed')
    }
  }

  const row = (label: string, value: number, opts?: { strong?: boolean; muted?: boolean }) => (
    <div className="flex justify-between items-center">
      <span
        className="font-inter text-[12.5px]"
        style={{ color: opts?.muted ? 'var(--mute)' : 'var(--ink)' }}
      >
        {label}
      </span>
      <span
        className={opts?.strong ? 'font-playfair font-bold text-[15px]' : 'font-inter text-[12.5px]'}
        style={{ color: opts?.strong ? 'var(--maroon)' : 'var(--ink)' }}
      >
        {formatMoney(value)}
      </span>
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="checkout-backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(42,30,30,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={payState === 'processing' ? undefined : onClose}
          />

          <motion.div
            key="checkout-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] sm:max-w-[560px] z-50 rounded-t-3xl overflow-hidden flex flex-col"
            style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-sheet)', maxHeight: '90dvh' }}
          >
            {/* Header */}
            <div
              className="flex items-center px-5 pt-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(217,160,58,0.2)' }}
            >
              <div className="flex-1">
                <h3 className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>
                  {tr('checkout.title')}
                </h3>
                <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                  {tr('checkout.subtitle')}
                </p>
              </div>
              <motion.button
                whileTap={btnIcon.tap}
                onClick={onClose}
                disabled={payState === 'processing'}
                aria-label="Close checkout"
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,16,36,0.08)' }}
              >
                <X size={15} style={{ color: 'var(--maroon)' }} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Bill breakdown */}
              <div className="flex flex-col gap-2">
                {row(tr('checkout.subtotal'), totals.subtotal)}
                {row(tr('checkout.serviceCharge'), totals.serviceCharge, { muted: true })}
                {gst.map(c => (
                  <div key={c.label} className="flex justify-between items-center">
                    <span className="font-inter text-[12.5px]" style={{ color: 'var(--mute)' }}>
                      {/CGST/i.test(c.label) ? tr('checkout.cgst') : tr('checkout.sgst')} {c.pct}%
                    </span>
                    <span className="font-inter text-[12.5px]" style={{ color: 'var(--ink)' }}>
                      {formatMoney(c.amount)}
                    </span>
                  </div>
                ))}
                {tipAmount > 0 && row(tr('checkout.tip'), tipAmount, { muted: true })}
              </div>

              {/* Tip selector */}
              <div className="flex flex-col gap-2">
                <p className="font-inter text-[11px] uppercase tracking-widest" style={{ color: 'var(--mute)' }}>
                  {tr('checkout.tipLabel')}
                </p>
                <div className="flex gap-2">
                  {TIP_PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => setTipPct(p)}
                      className="flex-1 py-2 rounded-full font-inter text-[12px] font-medium transition-colors"
                      style={{
                        background: tipPct === p ? 'var(--maroon)' : 'rgba(139,16,36,0.08)',
                        color: tipPct === p ? '#FFF8EA' : 'var(--maroon)',
                      }}
                    >
                      {p === 0 ? tr('checkout.tipNone') : `${p}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split selector */}
              <div className="flex flex-col gap-2">
                <p className="font-inter text-[11px] uppercase tracking-widest" style={{ color: 'var(--mute)' }}>
                  {tr('checkout.splitLabel')}
                </p>
                <div className="flex gap-2">
                  {SPLIT_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setWays(n)}
                      className="flex-1 py-2 rounded-full font-inter text-[12px] font-medium transition-colors"
                      style={{
                        background: ways === n ? 'var(--maroon)' : 'rgba(139,16,36,0.08)',
                        color: ways === n ? '#FFF8EA' : 'var(--maroon)',
                      }}
                    >
                      {n === 1 ? tr('checkout.splitNone') : `${n} ${tr('checkout.splitWays')}`}
                    </button>
                  ))}
                </div>
                {perPerson && (
                  <p className="font-inter text-[11.5px]" style={{ color: 'var(--gold)' }}>
                    {perPerson.shares[0].amount === perPerson.shares[perPerson.shares.length - 1].amount
                      ? `${formatMoney(perPerson.shares[0].amount)} ${tr('checkout.perPerson')}`
                      : `${formatMoney(perPerson.shares[perPerson.shares.length - 1].amount)}–${formatMoney(perPerson.shares[0].amount)} ${tr('checkout.perPerson')}`}
                  </p>
                )}
              </div>

              {/* Upsell strip */}
              {upsells.length > 0 && payState === 'idle' && (
                <div className="flex flex-col gap-2">
                  <p className="font-playfair italic text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                    {tr('checkout.upsellTitle')}
                  </p>
                  <div className="flex gap-2">
                    {upsells.map(u => (
                      <button
                        key={u.id}
                        onClick={() => onAddUpsell?.(u)}
                        className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-left"
                        style={{ border: '1px solid rgba(217,160,58,0.3)', background: 'rgba(217,160,58,0.06)' }}
                      >
                        <span className="min-w-0">
                          <span className="block font-playfair text-[12.5px] truncate" style={{ color: 'var(--ink)' }}>
                            {u.name}
                          </span>
                          <span className="block font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                            {formatMoney(u.price)}
                          </span>
                        </span>
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--maroon)' }}
                        >
                          <Plus size={13} color="#FFF8EA" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — total + pay */}
            <div
              className="flex-shrink-0 px-5 py-4"
              style={{ borderTop: '1.5px solid var(--gold)', background: 'var(--paper)' }}
            >
              <div className="flex justify-between items-center mb-3">
                <p className="font-inter text-[11px] uppercase tracking-widest" style={{ color: 'var(--mute)' }}>
                  {tr('checkout.total')}
                </p>
                <p className="font-playfair font-bold text-[22px]" style={{ color: 'var(--maroon)' }}>
                  <AnimatedNumber value={grandTotal} format={formatMoney} />
                </p>
              </div>

              {(payState === 'failed' || payState === 'dismissed') && (
                <p className="font-inter text-center text-[12px] mb-2" style={{ color: 'var(--maroon)' }}>
                  {tr(payState === 'failed' ? 'checkout.failed' : 'checkout.dismissed')}
                </p>
              )}

              <motion.button
                whileTap={payState === 'idle' ? btnPrimary.tap : undefined}
                onClick={handlePay}
                disabled={payState === 'processing' || payState === 'paid'}
                className="w-full py-3.5 rounded-full font-inter font-semibold text-[13.5px] flex items-center justify-center gap-2 select-none"
                style={{
                  background: 'linear-gradient(135deg, #A52030, #7A0E1E)',
                  color: '#FFF8EA',
                  boxShadow: '0 4px 16px rgba(139,16,36,0.28)',
                  minHeight: 48,
                }}
              >
                <AnimatePresence mode="wait">
                  {payState === 'paid' ? (
                    <motion.span key="paid" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                      <CheckCircle2 size={18} /> {tr('checkout.paid')}
                    </motion.span>
                  ) : payState === 'processing' ? (
                    <motion.span key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> {tr('checkout.processing')}
                    </motion.span>
                  ) : (
                    <motion.span key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                      {tr('checkout.payNow')} · {formatMoney(grandTotal)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <div className="flex items-center justify-center gap-1.5 mt-2">
                <ShieldCheck size={12} style={{ color: 'var(--mute)' }} />
                <p className="font-inter text-[10px]" style={{ color: 'var(--mute)' }}>
                  {isRazorpayConfigured ? tr('checkout.secured') : tr('checkout.demoNote')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
