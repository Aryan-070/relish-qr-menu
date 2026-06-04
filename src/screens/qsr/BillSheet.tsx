import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ReceiptText, CreditCard, BellRing } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { bodyStyle, sectionTitleStyle, headingStyle, isHard } from '../../console/lib/skin'
import { formatMoney } from '../../lib/money'
import { Button } from '../../console/components/Button'
import { openRazorpayCheckout, isRazorpayConfigured } from '../../lib/payments/openRazorpayCheckout'
import type { UseSessionResult } from '../../hooks/useSession'

interface BillSheetProps {
  open: boolean
  session: UseSessionResult
  onClose: () => void
}

/**
 * The guest bill: the session's confirmed orders + server-computed Check totals
 * (all from the live snapshot, in paise). "Request bill" flags the table for a
 * server; "Pay" creates a Razorpay order via the backend and opens checkout —
 * falling back to a clear "pay at the counter" when online payment is
 * unavailable (no keys configured).
 */
export function BillSheet({ open, session, onClose }: BillSheetProps) {
  const { tokens: t } = useTheme()
  const [busy, setBusy] = useState<'bill' | 'pay' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const radius = isHard(t) ? 0 : 999
  const sheetRadius = isHard(t) ? 0 : 22

  const snapshot = session.session
  const check = snapshot?.check ?? null
  const orders = snapshot?.orders ?? []
  const total = check?.total_minor ?? 0
  const settled = check?.status === 'settled'

  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(null), 3200)
  }

  const requestBill = async () => {
    setBusy('bill')
    try {
      await session.askForBill()
      flash('Your server has been notified.')
    } catch {
      flash('Could not request the bill — please wave your server over.')
    } finally {
      setBusy(null)
    }
  }

  const pay = async () => {
    setBusy('pay')
    try {
      const result = await session.pay()
      if (!isRazorpayConfigured) {
        flash('Please pay at the counter — online payment isn’t set up here.')
        return
      }
      await openRazorpayCheckout({
        orderId: result.order_id,
        amountMinor: result.amount_minor,
        description: 'The Table Theory — table bill',
        onSuccess: () => {
          session.refetch()
          flash('Payment received — thank you!')
        },
      })
    } catch {
      // pay() 503 (no keys) or checkout failure → counter fallback.
      flash('Please pay at the counter — online payment is unavailable right now.')
    } finally {
      setBusy(null)
    }
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
            aria-label="Your bill"
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
            <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
              <ReceiptText size={18} style={{ color: t.accent }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em]" style={bodyStyle(t)}>The table bill</p>
                <h2 className="text-[20px] leading-none" style={headingStyle(t)}>
                  {settled ? 'Settled' : formatMoney(Math.round(total / 100))}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close bill"
                className="w-9 h-9 flex items-center justify-center"
                style={{ background: `${t.accent}14`, color: t.accent, borderRadius: radius }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {orders.length === 0 ? (
                <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>
                  No orders yet — your bill builds as the table orders.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {orders.flatMap(o =>
                    o.lines.map(l => (
                      <div key={l.id} className="flex items-center gap-3">
                        <span className="text-[14px] flex-1 truncate" style={{ ...sectionTitleStyle(t), color: t.ink }}>
                          {l.qty}× {l.item_name}
                        </span>
                        <span className="text-[13px]" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                          {formatMoney(Math.round((l.unit_price_minor * l.qty) / 100))}
                        </span>
                      </div>
                    )),
                  )}
                </div>
              )}
            </div>

            {check && (
              <div className="px-5 pt-2" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
                <Row label="Subtotal" value={check.subtotal_minor} t={t} />
                <Row label="Tax" value={check.tax_minor} t={t} />
                {check.service_charge_minor > 0 && (
                  <Row label="Service" value={check.service_charge_minor} t={t} />
                )}
                <Row label="Total" value={check.total_minor} t={t} bold />
              </div>
            )}

            {msg && (
              <p className="px-5 text-[12px] pt-1" style={{ ...bodyStyle(t), color: t.accent }}>{msg}</p>
            )}

            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ borderTop: `1px solid ${t.ruleColor}`, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <Button
                variant="ghost"
                size="md"
                onClick={requestBill}
                disabled={busy !== null || settled}
                aria-label="Request the bill"
              >
                <BellRing size={16} /> Request bill
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={pay}
                disabled={busy !== null || settled || total <= 0}
                aria-label="Pay the bill"
              >
                <CreditCard size={16} /> {busy === 'pay' ? 'Opening…' : settled ? 'Paid' : `Pay ${formatMoney(Math.round(total / 100))}`}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, t, bold }: { label: string; value: number; t: ReturnType<typeof useTheme>['tokens']; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[13px]" style={{ ...bodyStyle(t), fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span
        className="text-[14px]"
        style={{ fontFamily: t.priceFont, color: t.priceColor, fontWeight: bold ? 700 : 400 }}
      >
        {formatMoney(Math.round(value / 100))}
      </span>
    </div>
  )
}
