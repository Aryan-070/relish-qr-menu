import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { type UiTheme, type ThemeTokens, THEMES, shadcnVars } from './themes'

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
    if (s === 'warm' || s === 'hybrid' || s === 'brutalist' || s === 'editorial' || s === 'table-theory') return s
  } catch {
    /* ignore */
  }
  return 'warm'
}

/**
 * `forced` pins the theme for a subtree (e.g. the `/qsr` brand surface always
 * renders in 'table-theory'), bypassing the stored/user-selectable theme and
 * never writing to localStorage. Without it, the theme is user-selectable and
 * persisted. Nesting a forced provider overrides the outer one for its children.
 */
export function ThemeProvider({ children, forced }: { children: ReactNode; forced?: UiTheme }) {
  const [stored, setStored] = useState<UiTheme>(readStored)
  const theme = forced ?? stored

  useEffect(() => {
    if (!forced) {
      try {
        localStorage.setItem(STORAGE_KEY, theme)
      } catch {
        /* ignore */
      }
    }
    // Mirror the active theme's shadcn token set onto :root so shadcn / Cult UI /
    // Watermelon components — including Radix overlays that portal to document.body
    // (outside the .app-shell where data-ui-theme lives) — inherit the active skin.
    const root = document.documentElement
    const vars = shadcnVars(THEMES[theme])
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  }, [theme, forced])

  const setTheme = forced ? () => {} : setStored

  const value = useMemo(
    () => ({ theme, tokens: THEMES[theme], setTheme }),
    [theme, forced],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>

}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
