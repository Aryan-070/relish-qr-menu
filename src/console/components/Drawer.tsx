import { type ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Sticky footer (actions). */
  footer?: ReactNode
  width?: number
}

/**
 * Right-side slide-in panel for forms (menu CRUD, bill detail). Radix-backed
 * (focus trap, scroll-lock, Escape) with the same prop API as before.
 */
export function Drawer({ open, onClose, title, children, footer, width = 440 }: DrawerProps) {
  const { tokens: t } = useTheme()
  const surface = t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6'

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-hidden p-0"
        style={{ width, maxWidth: '92vw', background: surface, borderLeft: `1px solid ${t.ruleColor}` }}
      >
        <header className="shrink-0 px-5 py-4" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
          <SheetTitle asChild>
            <h2 style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600, fontSize: 17 }}>{title}</h2>
          </SheetTitle>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer
            className="flex shrink-0 justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: `1px solid ${t.ruleColor}` }}
          >
            {footer}
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}
