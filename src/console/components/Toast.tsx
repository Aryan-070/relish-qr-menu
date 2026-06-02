import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { useTheme } from '../../theme/ThemeContext'

type ToastKind = 'success' | 'info' | 'warn'

interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastCtx | null>(null)

/**
 * Toast surface backed by `sonner` (stacking, swipe-to-dismiss, a11y) but
 * exposing the same `useToast().push(message, kind)` API as before, so every
 * call site is unchanged. Styled from the active theme tokens.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { tokens: t } = useTheme()

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    if (kind === 'success') toast.success(message)
    else if (kind === 'warn') toast.warning(message)
    else toast.message(message)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <Toaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          style: {
            background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6',
            color: t.ink,
            border: `1px solid ${t.ruleColor}`,
            borderRadius: `${Math.max(t.cardRadius, 8)}px`,
            fontFamily: t.descFont,
            fontSize: '13px',
          },
        }}
      />
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
