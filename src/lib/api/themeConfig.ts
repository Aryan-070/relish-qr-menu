/**
 * Per-restaurant theme/branding config (`/api/theme/`). Drives the admin
 * Appearance panel: pick a UI theme + landing variant, override brand colors and
 * fonts (incl. an imported custom font), and set a logo/cover. Draft→publish so
 * edits can be staged before going live to guests.
 */
import { apiFetch } from './client'

export type UiThemeKey = 'warm' | 'hybrid' | 'brutalist' | 'editorial' | 'table-theory'
export type LandingVariantKey =
  | 'signature'
  | 'classic'
  | 'gastronomique'
  | 'editorial'
  | 'botanica'
  | 'cinematic'
  | 'reel'

export interface BrandColors {
  primary?: string
  secondary?: string
  accent?: string
}

export interface FontChoices {
  heading?: string
  body?: string
}

export interface CustomFont {
  name?: string
  url?: string
}

export interface ThemeConfig {
  ui_theme: UiThemeKey
  landing_variant: LandingVariantKey
  component_style: 'classic' | 'motion' | 'spectacle'
  media_mode: 'video' | 'image'
  token_overrides: Record<string, unknown>
  brand_colors: BrandColors
  font_choices: FontChoices
  custom_font: CustomFont
  allow_customer_choice: boolean
  customer_choices: string[]
  logo_url: string
  cover_url: string
  published?: boolean
}

/** Fields the admin can write (the server treats the rest as read-only). */
export type ThemeConfigPatch = Partial<
  Pick<
    ThemeConfig,
    | 'ui_theme'
    | 'landing_variant'
    | 'component_style'
    | 'media_mode'
    | 'token_overrides'
    | 'brand_colors'
    | 'font_choices'
    | 'custom_font'
    | 'allow_customer_choice'
    | 'customer_choices'
    | 'logo_url'
    | 'cover_url'
  >
>

export function getThemeConfig(): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>('/theme/')
}

export function putThemeConfig(patch: ThemeConfigPatch): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>('/theme/', { method: 'PUT', body: patch })
}

export function saveThemeDraft(draft: ThemeConfigPatch): Promise<{ draft: ThemeConfigPatch }> {
  return apiFetch('/theme/draft/', { method: 'PUT', body: { draft } })
}

export function publishTheme(): Promise<ThemeConfig> {
  return apiFetch<ThemeConfig>('/theme/publish/', { method: 'POST' })
}
