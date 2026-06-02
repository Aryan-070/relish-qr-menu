import { type ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/**
 * Centered modal dialog (confirmations, quick forms). Radix-backed (focus trap,
 * scroll-lock, Escape, portal) with the same prop API as before. Themed via the
 * bridge tokens; surface tinted to match the console's raised panels.
 */
export function Modal({ open, onClose, title, children, footer, width = 420 }: ModalProps) {
  const { tokens: t } = useTheme()
  const surface = t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-lg p-0"
        style={{ width: '100%', maxWidth: width, background: surface, border: `1px solid ${t.ruleColor}` }}
      >
        {title ? (
          <header className="shrink-0 px-5 py-4" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
            <DialogTitle asChild>
              <h2 style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600, fontSize: 16 }}>{title}</h2>
            </DialogTitle>
          </header>
        ) : (
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer
            className="flex shrink-0 justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: `1px solid ${t.ruleColor}` }}
          >
            {footer}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  )
}
