import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Dialog accessibility for Modal/Drawer:
 * - Escape closes
 * - focus moves into the panel on open and is restored to the opener on close
 * - Tab is trapped within the panel
 * Returns a ref to attach to the dialog panel element.
 *
 * `onClose` is read through a ref so the effect depends only on `open` — this
 * keeps the opener captured exactly once per open (callers usually pass an inline
 * handler whose identity changes every render).
 */
export function useDialogA11y(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null

    // Move focus into the panel (first focusable, else the panel itself).
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        el => el.offsetParent !== null,
      )
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openerRef.current?.focus?.()
    }
  }, [open])

  return panelRef
}
