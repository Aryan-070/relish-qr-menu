import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, ChevronLeft } from 'lucide-react'
import { BellRipple } from '../components/animations/BellRipple'
import { bottomPanel, stagger, fadeUp } from '../animations/variants'

type PanelView = 'options' | 'sent' | 'jain'

const JAIN_INFO = [
  { q: 'What is Jain food?', a: 'Jain cuisine avoids root vegetables (onion, garlic, potato, carrot, radish) and any ingredient that harms living organisms.' },
  { q: 'Which items are fully Jain?', a: 'Items marked with the Jain badge are prepared without any root vegetables. Look for the green "Jain" badge on the menu.' },
  { q: 'Can dishes be made Jain?', a: 'Many dishes show "Can be Jain" — these can be prepared Jain-friendly on request. Please inform your waiter before ordering.' },
  { q: 'Cross-contamination?', a: 'Our kitchen takes care with Jain orders, but we use a shared kitchen. Please speak to the waiter for strict requirements.' },
]

const WAITER_OPTIONS = [
  { id: 'choose',  label: 'Need help choosing',  icon: '✦',  action: 'recommend' },
  { id: 'order',   label: 'Place order',          icon: '📋', action: 'send' },
  { id: 'water',   label: 'Request water',        icon: '💧', action: 'send' },
  { id: 'jain',    label: 'Jain menu details',    icon: '🌿', action: 'jain' },
  { id: 'bill',    label: 'Bill request',         icon: '🧾', action: 'send' },
] as const

interface WaiterPanelProps {
  open: boolean
  onClose: () => void
  onRecommend?: () => void
}

export function WaiterPanel({ open, onClose, onRecommend }: WaiterPanelProps) {
  const [view, setView] = useState<PanelView>('options')
  const [sentLabel, setSentLabel] = useState('')

  useEffect(() => {
    if (open) {
      setView('options')
      setSentLabel('')
    }
  }, [open])

  const handleOption = (opt: typeof WAITER_OPTIONS[number]) => {
    if (opt.action === 'recommend') {
      // Navigate to recommendation — close panel first, then navigate
      onClose()
      // Small delay to let close animation start before route change
      setTimeout(() => onRecommend?.(), 60)
      return
    }
    if (opt.action === 'jain') {
      setView('jain')
      return
    }
    // send
    setSentLabel(opt.label)
    setView('sent')
    setTimeout(() => {
      setView('options')
      setSentLabel('')
      onClose()
    }, 2200)
  }

  const handleClose = () => {
    setView('options')
    setSentLabel('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="waiter-backdrop"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(42,30,30,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            key="waiter-panel"
            variants={bottomPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden"
            style={{
              background: 'var(--paper)',
              boxShadow: 'var(--shadow-sheet)',
              maxHeight: '85dvh',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--mute)', opacity: 0.4 }} />
            </div>

            {/* Header row */}
            <div className="flex items-center px-5 pt-1 pb-3" style={{ borderBottom: '1px solid rgba(217,160,58,0.18)' }}>
              {view === 'jain' ? (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setView('options')}
                  className="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                  style={{ background: 'rgba(139,16,36,0.08)' }}
                >
                  <ChevronLeft size={16} style={{ color: 'var(--maroon)' }} />
                </motion.button>
              ) : (
                <div className="mr-3">
                  <BellRipple size={20} color="#D9A03A" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-playfair font-bold text-[17px]" style={{ color: 'var(--maroon)' }}>
                  {view === 'jain' ? 'Jain Menu Details' : 'Call Waiter'}
                </h3>
                {view === 'options' && (
                  <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                    What can we help you with?
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center ml-2"
                style={{ background: 'rgba(139,16,36,0.08)' }}
              >
                <X size={15} style={{ color: 'var(--maroon)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 80px)' }}>
              <AnimatePresence mode="wait">
                {view === 'options' && (
                  <motion.div
                    key="options"
                    variants={stagger}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-2.5 px-5 py-4 pb-8"
                  >
                    {WAITER_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.id}
                        variants={fadeUp}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOption(opt)}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left w-full transition-colors"
                        style={{
                          background: 'rgba(217,160,58,0.07)',
                          border: '1px solid rgba(217,160,58,0.25)',
                        }}
                      >
                        <span className="text-xl w-7 flex-shrink-0 text-center leading-none">{opt.icon}</span>
                        <span className="font-inter font-medium text-[14px]" style={{ color: 'var(--ink)' }}>
                          {opt.label}
                        </span>
                        {opt.action === 'jain' && (
                          <span className="ml-auto font-inter text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,122,60,0.12)', color: 'var(--olive)' }}>
                            Info
                          </span>
                        )}
                        {opt.action === 'recommend' && (
                          <span className="ml-auto font-inter text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,160,58,0.15)', color: 'var(--gold)' }}>
                            AI
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {view === 'sent' && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3 py-10 px-5"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
                    >
                      <CheckCircle2 size={48} style={{ color: 'var(--olive)' }} />
                    </motion.div>
                    <p className="font-playfair font-semibold text-[18px] text-center" style={{ color: 'var(--maroon)' }}>
                      Request sent to waiter
                    </p>
                    <p className="font-inter text-[13px] text-center" style={{ color: 'var(--mute)' }}>
                      {sentLabel}
                    </p>
                    <p className="font-inter text-[11px] text-center mt-1" style={{ color: 'var(--mute)' }}>
                      We'll be with you shortly
                    </p>
                  </motion.div>
                )}

                {view === 'jain' && (
                  <motion.div
                    key="jain"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="px-5 py-4 pb-8 flex flex-col gap-4"
                  >
                    {/* Jain badge header */}
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(79,122,60,0.08)', border: '1px solid rgba(79,122,60,0.25)' }}
                    >
                      <span className="text-2xl">🌿</span>
                      <div>
                        <p className="font-playfair font-semibold text-[14px]" style={{ color: 'var(--olive)' }}>
                          Jain-Friendly Options Available
                        </p>
                        <p className="font-inter text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          Always inform your waiter before ordering
                        </p>
                      </div>
                    </div>

                    {JAIN_INFO.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex flex-col gap-1"
                      >
                        <p className="font-inter font-semibold text-[13px]" style={{ color: 'var(--maroon)' }}>
                          {item.q}
                        </p>
                        <p className="font-inter text-[12px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                          {item.a}
                        </p>
                        {i < JAIN_INFO.length - 1 && <div className="gold-divider mt-1" />}
                      </motion.div>
                    ))}

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSentLabel('Jain details request')
                        setView('sent')
                        setTimeout(() => { setView('options'); setSentLabel(''); onClose() }, 2200)
                      }}
                      className="w-full py-3 rounded-full font-inter font-semibold text-[13px] mt-2"
                      style={{ background: 'rgba(79,122,60,0.12)', color: 'var(--olive)', border: '1px solid rgba(79,122,60,0.3)' }}
                    >
                      Still have questions? Call waiter
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
