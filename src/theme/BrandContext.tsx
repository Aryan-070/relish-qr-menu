/**
 * Per-restaurant branding (logo / cover photo / display name) surfaced to the
 * top bars and the Appearance preview. Set by the Appearance config loader
 * (console) or the storefront root from the published theme config.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface Brand {
  logoUrl: string | null
  coverUrl: string | null
  displayName: string | null
}

export interface BrandContextValue extends Brand {
  setBrand: (b: Partial<Brand>) => void
}

const DEFAULT_BRAND: Brand = { logoUrl: null, coverUrl: null, displayName: null }

const Ctx = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<Brand>(DEFAULT_BRAND)
  // Stable setter — and a no-op when nothing actually changed — so callers used
  // inside effects (applyThemeConfig) don't churn their identity and loop.
  const setBrand = useCallback((b: Partial<Brand>) => {
    setBrandState((prev) => {
      const next = { ...prev, ...b }
      if (next.logoUrl === prev.logoUrl && next.coverUrl === prev.coverUrl && next.displayName === prev.displayName) {
        return prev
      }
      return next
    })
  }, [])
  const value = useMemo<BrandContextValue>(() => ({ ...brand, setBrand }), [brand, setBrand])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Read brand info. Returns nulls + a no-op setter outside a provider. */
export function useBrand(): BrandContextValue {
  return (
    useContext(Ctx) ?? {
      ...DEFAULT_BRAND,
      setBrand: () => {},
    }
  )
}
