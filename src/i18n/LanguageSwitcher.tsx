/**
 * Self-contained language switcher.
 *
 * Toggles/cycles through {@link LANGUAGES} via {@link useLanguage} and shows the
 * NEXT language's native label as its affordance (tap to switch to it). Styled
 * with inline styles only — intentionally independent of the app's theme system
 * so it can be dropped anywhere without a `ThemeProvider`.
 */
import { useLanguage } from './LanguageContext'
import { LANGUAGES } from './types'

interface LanguageSwitcherProps {
  /** Optional class hook for positioning by the parent. */
  className?: string
  /** Optional style overrides merged over the defaults. */
  style?: React.CSSProperties
}

/** Index of the next language in the cycle, wrapping around. */
function nextIndex(current: number): number {
  return (current + 1) % LANGUAGES.length
}

export function LanguageSwitcher({ className, style }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage()

  const currentIdx = LANGUAGES.findIndex(l => l.code === language)
  const safeIdx = currentIdx === -1 ? 0 : currentIdx
  const current = LANGUAGES[safeIdx]
  const upcoming = LANGUAGES[nextIndex(safeIdx)]

  return (
    <button
      type="button"
      onClick={() => setLanguage(upcoming.code)}
      aria-label={`Switch language to ${upcoming.label}`}
      title={`${current.nativeLabel} → ${upcoming.nativeLabel}`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        border: '1px solid rgba(217,160,58,0.45)',
        background: 'rgba(217,160,58,0.10)',
        color: '#8B1024',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1,
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: 13, opacity: 0.7 }}
      >
        🌐
      </span>
      <span>{current.nativeLabel}</span>
    </button>
  )
}
