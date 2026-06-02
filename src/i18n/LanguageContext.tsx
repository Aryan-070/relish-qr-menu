/**
 * Language context + provider for the Relish QR app.
 *
 * Holds the active {@link Language} and persists the guest's choice to
 * `localStorage` under {@link STORAGE_KEY}. Reads the persisted value once on
 * init (SSR-safe via a `typeof window` guard) and writes it back on change.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Language } from './types'

/** localStorage key the language choice is persisted under. */
export const STORAGE_KEY = 'relish.lang'

/** Default language when nothing valid is persisted. */
const DEFAULT_LANGUAGE: Language = 'en'

/** Shape exposed by {@link useLanguage}. */
export interface LanguageContextValue {
  /** The currently active language. */
  language: Language
  /** Set (and persist) the active language. */
  setLanguage: (next: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/** Narrow an untrusted string to a valid {@link Language}, else `null`. */
function asLanguage(value: string | null): Language | null {
  return value === 'en' || value === 'hi' ? value : null
}

/** Read the persisted language from storage, guarding non-browser environments. */
function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  try {
    return asLanguage(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_LANGUAGE
  } catch {
    // Private mode / disabled storage — fall back to the default.
    return DEFAULT_LANGUAGE
  }
}

interface LanguageProviderProps {
  children: ReactNode
}

/**
 * Provides the active language to the tree. Wrap the app (or the guest shell)
 * with this so {@link useLanguage} and the translation hooks resolve correctly.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
  }, [])

  // Persist on change (effect, not in the setter, so it stays a pure update).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // Ignore storage write failures (private mode / quota).
    }
  }, [language])

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/**
 * Access the active language and setter.
 *
 * @throws if called outside a {@link LanguageProvider}.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (ctx === null) {
    throw new Error('useLanguage must be used within a <LanguageProvider>')
  }
  return ctx
}
