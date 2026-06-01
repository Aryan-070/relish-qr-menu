import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'
import { btnIcon } from '../../animations/variants'
import { useDialogA11y } from './useDialogA11y'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** Centered modal dialog (confirmations, quick forms). */
export function Modal({ open, onClose, title, children, footer, width = 420 }: ModalProps) {
  const { tokens: t } = useTheme()
  const panelRef = useDialogA11y(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="relative w-full max-h-[88vh] flex flex-col overflow-hidden focus:outline-none"
            style={{ ...panelStyle(t), maxWidth: width }}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            {title && (
              <header className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
                <h2 className="text-[16px]" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}>
                  {title}
                </h2>
                <motion.button
                  whileTap={btnIcon.tap}
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5"
                  style={{ color: t.inkSoft }}
                >
                  <X size={16} />
                </motion.button>
              </header>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="shrink-0 px-5 py-3.5 flex gap-2 justify-end" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
