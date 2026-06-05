/**
 * Apply a per-restaurant ThemeConfig to the running app: switch the UI theme,
 * layer brand colors + fonts as token overrides, inject an imported custom font,
 * and publish the logo/cover into the BrandContext.
 */
import { useCallback } from 'react'
import { useTheme } from './ThemeContext'
import { useBrand } from './BrandContext'
import type { ThemeTokens, UiTheme } from './themes'
import type { ThemeConfig } from '../lib/api/themeConfig'

const CUSTOM_FONT_STYLE_ID = 'relish-custom-font'

/** Inject (or replace) an @font-face for an imported font. */
function injectCustomFont(name?: string, url?: string): string | null {
  if (typeof document === 'undefined') return null
  const existing = document.getElementById(CUSTOM_FONT_STYLE_ID)
  if (!name || !url) {
    existing?.remove()
    return null
  }
  const css = `@font-face{font-family:'${name}';src:url('${url}');font-display:swap;}`
  if (existing) {
    existing.textContent = css
  } else {
    const style = document.createElement('style')
    style.id = CUSTOM_FONT_STYLE_ID
    style.textContent = css
    document.head.appendChild(style)
  }
  return name
}

/** Build the token override patch (colors + fonts) from a config. */
export function tokenOverridesFromConfig(config: ThemeConfig): Partial<ThemeTokens> {
  const o: Partial<ThemeTokens> = {}
  const { brand_colors: colors, font_choices: fonts, custom_font: custom } = config

  if (colors?.primary) o.accent = colors.primary
  if (colors?.secondary) o.accent2 = colors.secondary

  // A custom imported font wins; otherwise a picked family; otherwise the preset.
  const headingFamily = fonts?.heading || custom?.name
  const bodyFamily = fonts?.body || custom?.name
  if (headingFamily) {
    const stack = `'${headingFamily}', Georgia, serif`
    o.headerFont = stack
    o.titleFont = stack
  }
  if (bodyFamily) {
    o.descFont = `'${bodyFamily}', system-ui, sans-serif`
  }
  return o
}

export interface ApplyThemeConfig {
  (config: ThemeConfig | null | undefined): void
}

/** Returns a stable `apply(config)` that mutates theme + brand + injected font. */
export function useApplyThemeConfig(): ApplyThemeConfig {
  const { setTheme, setOverrides } = useTheme()
  const { setBrand } = useBrand()

  return useCallback(
    (config) => {
      if (!config) return
      setTheme(config.ui_theme as UiTheme)
      injectCustomFont(config.custom_font?.name, config.custom_font?.url)
      setOverrides(tokenOverridesFromConfig(config))
      setBrand({
        logoUrl: config.logo_url || null,
        coverUrl: config.cover_url || null,
      })
      // Expose the third brand color as a CSS var for ad-hoc styling.
      if (typeof document !== 'undefined' && config.brand_colors?.accent) {
        document.documentElement.style.setProperty('--brand-accent', config.brand_colors.accent)
      }
    },
    [setTheme, setOverrides, setBrand],
  )
}
