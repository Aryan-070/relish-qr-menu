import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { type UiTheme, type ThemeTokens, THEMES } from './themes'

interface ThemeCtx {
  theme: UiTheme
  tokens: ThemeTokens
  setTheme: (t: UiTheme) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const STORAGE_KEY = 'relish-ui-theme'

function readStored(): UiTheme {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'warm' || s === 'hybrid' || s === 'brutalist') return s
  } catch {
    /* ignore */
  }
  return 'warm'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<UiTheme>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const value = useMemo(
    () => ({ theme, tokens: THEMES[theme], setTheme }),
    [theme],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>

}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
