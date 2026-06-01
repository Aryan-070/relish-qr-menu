import type { CSSProperties } from 'react'
import { Flame, ChefHat } from 'lucide-react'
import type { ThemeTokens } from '../../theme/themes'

// Theme-aware dietary / tag / spice / chef chips.
// Soft & rounded in warm; hard-edged, monospaced, bracketed in hybrid/brutalist
// (brutalist goes monochrome ink). One contract, three skins — see theme.pill.

type Tokens = ThemeTokens

interface Semantic {
  text: string
  bg: string
  border: string
}

const JAIN: Semantic = { text: '#4F7A3C', bg: 'rgba(79,122,60,0.12)', border: 'rgba(79,122,60,0.55)' }
const TAG: Semantic = { text: '#8B6520', bg: 'rgba(217,160,58,0.14)', border: 'rgba(217,160,58,0.40)' }
const CHEF: Semantic = { text: '#9A6A12', bg: 'rgba(217,160,58,0.16)', border: 'rgba(217,160,58,0.55)' }
const SPICE_HUES = ['#E0851C', '#D2622A', '#C0392B'] as const // mild → medium → hot

function pillStyle(t: Tokens, s: Semantic): CSSProperties {
  const p = t.pill
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontFamily: p.font,
    fontSize: 8.5,
    letterSpacing: '0.07em',
    fontWeight: 700,
    textTransform: p.transform,
    color: p.monochrome ? p.monoInk : s.text,
    background: p.monochrome ? 'transparent' : s.bg,
    border: `1px solid ${p.monochrome ? p.monoInk : s.border}`,
    borderRadius: p.radius,
    padding: '2px 7px',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
  }
}

function label(t: Tokens, text: string): string {
  return t.pill.bracket ? `[ ${text} ]` : text
}

export function DietBadge({ label: text, theme: t }: { label: string; theme: Tokens }) {
  return <span style={pillStyle(t, JAIN)}>{label(t, text)}</span>
}

export function TagLabel({ label: text, theme: t }: { label: string; theme: Tokens }) {
  return (
    <span className="truncate" style={{ ...pillStyle(t, TAG), maxWidth: 96 }}>
      {label(t, text)}
    </span>
  )
}

export function ChefSpecial({ theme: t, compact = false }: { theme: Tokens; compact?: boolean }) {
  const ink = t.pill.monochrome ? t.pill.monoInk : CHEF.text
  return (
    <span style={pillStyle(t, CHEF)}>
      <ChefHat size={10} strokeWidth={2} style={{ color: ink }} />
      {label(t, compact ? "Chef's" : "Chef's Special")}
    </span>
  )
}

export function SpiceLevel({ level, theme: t }: { level?: 0 | 1 | 2 | 3; theme: Tokens }) {
  if (!level) return null
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 1 }}
      aria-label={`Spice level ${level} of 3`}
      title={`Spice level ${level}/3`}
    >
      {Array.from({ length: level }).map((_, i) => (
        <Flame
          key={i}
          size={12}
          strokeWidth={2}
          style={{ color: t.pill.monochrome ? t.pill.monoInk : SPICE_HUES[Math.min(i, 2)] }}
          fill={t.pill.monochrome ? 'none' : `${SPICE_HUES[Math.min(i, 2)]}33`}
        />
      ))}
    </span>
  )
}
