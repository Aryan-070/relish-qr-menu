/**
 * Translation lookup utilities.
 *
 * {@link translate} is a pure helper for non-hook callers; {@link useT} is the
 * React hook that binds the lookup to the active language from
 * {@link ./LanguageContext}. Both fall back gracefully: requested language →
 * English → the raw key, so the UI never renders `undefined`.
 */
import { useCallback } from 'react'
import { en } from './en'
import { hi } from './hi'
import { useLanguage } from './LanguageContext'
import type { Language, TranslationKey } from './types'

/** All language dictionaries, keyed by language code. */
const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  en,
  hi,
}

/**
 * Pure translation lookup for a given language. Use this outside of React
 * components (utilities, event handlers that already hold the language, etc.).
 *
 * Falls back to English, then to the raw key string, so the result is always a
 * non-empty, renderable string.
 */
export function translate(language: Language, key: TranslationKey): string {
  return dictionaries[language][key] ?? en[key] ?? key
}

/** A bound translate function: `t('order.total')` → localized string. */
export type TFunction = (key: TranslationKey) => string

/**
 * Hook returning a `t()` bound to the active language. The function identity is
 * stable for a given language, so it is safe to use in dependency arrays.
 */
export function useT(): TFunction {
  const { language } = useLanguage()
  return useCallback((key: TranslationKey) => translate(language, key), [language])
}
