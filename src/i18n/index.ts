/**
 * Public i18n API for the Relish QR app.
 *
 * Import everything translation-related from `@/i18n` (or relative `../i18n`)
 * rather than reaching into individual files:
 *
 * ```tsx
 * import { LanguageProvider, useT, LanguageSwitcher } from '../i18n'
 * ```
 */
export type { Language, LanguageOption, TranslationKey } from './types'
export { LANGUAGES } from './types'

export { en } from './en'
export { hi } from './hi'

export {
  LanguageProvider,
  useLanguage,
  STORAGE_KEY,
  type LanguageContextValue,
} from './LanguageContext'

export { useT, translate, type TFunction } from './useT'

export { LanguageSwitcher } from './LanguageSwitcher'
