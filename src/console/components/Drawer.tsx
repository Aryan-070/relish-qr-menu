import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { btnIcon } from '../../animations/variants'
import { useDialogA11y } from './useDialogA11y'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Sticky footer (actions). */
  footer?: ReactNode
  width?: number
}

/** Right-side slide-in panel for forms (menu CRUD, bill detail). */
export function Drawer({ open, onClose, title, children, footer, width = 440 }: DrawerProps) {
  const { tokens: t } = useTheme()
  const panelRef = useDialogA11y(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120]">
          <motion.div
            className="absolute inset-0 bg-black/40"
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
            className="absolute top-0 right-0 h-full flex flex-col max-w-[92vw] focus:outline-none"
            style={{ width, background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6', boxShadow: '-8px 0 40px rgba(42,30,30,0.22)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
              <h2 className="text-[17px]" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}>
                {title}
              </h2>
              <motion.button
                whileTap={btnIcon.tap}
                onClick={onClose}
                aria-label="Close panel"
                className="w-9 h-9 inline-flex items-center justify-center rounded-full cursor-pointer hover:bg-black/5"
                style={{ color: t.inkSoft }}
              >
                <X size={18} />
              </motion.button>
            </header>
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
