/**
 * Core i18n types for the Relish QR app.
 *
 * The set of supported languages is a small, explicit string-literal union so
 * exhaustiveness is checked at compile time. {@link TranslationKey} is derived
 * from the canonical English dictionary, making the English file the single
 * source of truth for which keys exist.
 */
import { en } from './en'

/** Supported UI languages. India-first (English + Hindi), global-ready. */
export type Language = 'en' | 'hi'

/** Descriptor for a selectable language, used by the switcher UI. */
export interface LanguageOption {
  /** BCP-47-ish short code persisted to storage and used for lookups. */
  code: Language
  /** Human label in English (for menus/settings). */
  label: string
  /** The language's own endonym (shown to native readers). */
  nativeLabel: string
}

/**
 * Ordered list of selectable languages. The order here is the cycle order used
 * by {@link ../i18n/LanguageSwitcher.tsx}.
 */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
] as const

/**
 * Union of every valid translation key, derived from the English dictionary.
 * Adding a key to `en.ts` automatically widens this type and forces every other
 * language dictionary (typed `Record<TranslationKey, string>`) to provide it.
 */
export type TranslationKey = keyof typeof en
