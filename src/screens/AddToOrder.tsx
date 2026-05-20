import { motion, AnimatePresence } from 'framer-motion'
import { type MenuItem } from '../data/menu'
import { Price } from '../components/atoms/Price'
import { Button } from '../components/atoms/Button'
import { orderSlip, checkmark } from '../animations/variants'

interface AddToOrderProps {
  item: MenuItem | null
  customization?: string
  onContinue: () => void
  onShowWaiter: () => void
}

export function AddToOrder({ item, customization = 'Regular', onContinue, onShowWaiter }: AddToOrderProps) {
  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="add-backdrop"
            className="fixed inset-0 z-60"
            style={{ background: 'rgba(42,30,30,0.65)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Order slip */}
          <motion.div
            key="order-slip"
            variants={orderSlip}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
            className="fixed inset-x-0 bottom-0 z-60 flex justify-center items-end pb-8 px-6"
          >
            <div
              className="w-full max-w-[340px] rounded-3xl overflow-hidden"
              style={{
                background: 'var(--paper)',
                border: '1.5px solid var(--gold)',
                boxShadow: '0 8px 40px rgba(42,30,30,0.25)',
              }}
            >
              {/* Gold top strip */}
              <div
                className="h-1.5"
                style={{
                  background: 'linear-gradient(to right, var(--maroon), var(--gold), var(--maroon))',
                }}
              />

              <div className="px-5 py-5">
                {/* Success check */}
                <div className="flex justify-center mb-3">
                  <motion.div
                    variants={checkmark}
                    initial="hidden"
                    animate="visible"
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(79,122,60,0.12)', border: '2px solid #4F7A3C' }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <motion.path
                        d="M5 13l4 4L19 7"
                        stroke="#4F7A3C"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
                      />
                    </svg>
                  </motion.div>
                </div>

                <p
                  className="text-center font-inter text-[11px] uppercase tracking-widest mb-3"
                  style={{ color: 'var(--olive)' }}
                >
                  Added to your order
                </p>

                {/* Torn-edge divider */}
                <div
                  className="w-full h-px mb-3"
                  style={{
                    background: 'repeating-linear-gradient(to right, var(--mute) 0, var(--mute) 6px, transparent 6px, transparent 12px)',
                    opacity: 0.5,
                  }}
                />

                {/* Item on the slip */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p
                      className="font-playfair font-semibold text-[16px]"
                      style={{ color: 'var(--ink)' }}
                    >
                      {item.name}
                    </p>
                    <p
                      className="font-inter text-[11px] mt-0.5"
                      style={{ color: 'var(--mute)' }}
                    >
                      {customization}
                    </p>
                  </div>
                  <Price amount={item.price} size="md" />
                </div>

                <div className="flex gap-3">
                  <Button variant="maroon" fullWidth onClick={onShowWaiter}>
                    Show to Waiter
                  </Button>
                  <Button variant="ghost" fullWidth onClick={onContinue}>
                    Continue
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
