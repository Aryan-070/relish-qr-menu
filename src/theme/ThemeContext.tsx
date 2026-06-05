import { createContext, useCallback, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { type UiTheme, type ThemeTokens, THEMES, shadcnVars } from './themes'

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => a[k] === b[k])
}

interface ThemeCtx {
  theme: UiTheme
  tokens: ThemeTokens
  setTheme: (t: UiTheme) => void
  /** Layer per-restaurant token overrides (colors/fonts) on top of the preset. */
  setOverrides: (o: Partial<ThemeTokens>) => void
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
 *
 * `setOverrides` lets the per-restaurant Appearance config layer brand colors
 * and fonts on top of the chosen preset, so `useTheme().tokens` reflects them
 * everywhere (and the merged set is mirrored onto `:root` for shadcn/CSS).
 */
export function ThemeProvider({ children, forced }: { children: ReactNode; forced?: UiTheme }) {
  const [stored, setStored] = useState<UiTheme>(readStored)
  const [overrides, setOverridesState] = useState<Partial<ThemeTokens>>({})
  const theme = forced ?? stored

  // Idempotent: ignore a new override object whose contents match the current
  // one, so callers passing a fresh `{}` each render can't drive a render loop.
  const setOverrides = useCallback((next: Partial<ThemeTokens>) => {
    setOverridesState((prev) =>
      shallowEqual(prev as Record<string, unknown>, next as Record<string, unknown>) ? prev : next,
    )
  }, [])

  const tokens = useMemo<ThemeTokens>(
    // A forced subtree ignores overrides (it's a fixed brand skin).
    () => (forced ? THEMES[theme] : { ...THEMES[theme], ...overrides }),
    [theme, forced, overrides],
  )

  useEffect(() => {
    if (!forced) {
      try {
        localStorage.setItem(STORAGE_KEY, theme)
      } catch {
        /* ignore */
      }
    }
    // Mirror the active (overridden) token set onto :root so shadcn / Cult UI /
    // Watermelon components — including Radix overlays that portal to document.body
    // (outside the .app-shell where data-ui-theme lives) — inherit the active skin.
    const root = document.documentElement
    const vars = shadcnVars(tokens)
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  }, [tokens, theme, forced])

  const value = useMemo(
    () => ({
      theme,
      tokens,
      setTheme: forced ? () => {} : setStored,
      setOverrides: forced ? () => {} : setOverrides,
    }),
    [theme, tokens, forced],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
