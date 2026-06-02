import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'

type ToastKind = 'success' | 'info' | 'warn'
interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const ICONS: Record<ToastKind, typeof Check> = { success: Check, info: Info, warn: AlertTriangle }
const ICON_COLOR: Record<ToastKind, string> = { success: '#3d6130', info: '#8B1024', warn: '#b3141b' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const { tokens: t } = useTheme()

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = (seq.current += 1)
    setToasts(prev => [...prev, { id, message, kind }])
    window.setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 2800)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map(toast => {
            const Icon = ICONS[toast.kind]
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                style={panelStyle(t)}
                className="flex items-center gap-2.5 px-4 py-2.5 min-w-[220px] max-w-[340px] pointer-events-auto"
              >
                <Icon size={16} aria-hidden style={{ color: ICON_COLOR[toast.kind] }} />
                <span className="text-[13px]" style={{ fontFamily: t.descFont, color: t.ink }}>
                  {toast.message}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
