import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'

// A second runtime dimension, orthogonal to the colour theme: it controls *how*
// interactive primitives (buttons, cards) behave, so the same palette can be
// compared across three interaction "engines".
//   classic   → the original, restrained press-only behaviour
//   motion    → Motion-Primitives-style spring hover + tactile lift + reveals
//   spectacle → Aceternity/Magic-UI-style magnetic / spotlight / 3D-tilt
export type ComponentStyle = 'classic' | 'motion' | 'spectacle'

export const COMPONENT_STYLES: { id: ComponentStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'motion', label: 'Motion' },
  { id: 'spectacle', label: 'Spectacle' },
]

interface ComponentStyleCtx {
  style: ComponentStyle
  setStyle: (s: ComponentStyle) => void
}

const Ctx = createContext<ComponentStyleCtx | null>(null)

const STORAGE_KEY = 'relish-component-style'

function readStored(): ComponentStyle {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'classic' || s === 'motion' || s === 'spectacle') return s
  } catch {
    /* ignore */
  }
  return 'classic'
}

export function ComponentStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<ComponentStyle>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, style)
    } catch {
      /* ignore */
    }
  }, [style])

  const value = useMemo(() => ({ style, setStyle }), [style])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useComponentStyle(): ComponentStyleCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useComponentStyle must be used within ComponentStyleProvider')
  return ctx
}
