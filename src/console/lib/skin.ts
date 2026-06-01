// Theme-derived style helpers so every console surface stays consistent with
// the guest app's three skins (warm / hybrid / brutalist) without re-deriving
// the same inline styles in each component.

import type { CSSProperties } from 'react'
import type { ThemeTokens } from '../../theme/themes'

/** Elevated surface (panels/cards). Falls back to a hairline rule when the
 *  theme card frame is borderless (hybrid/brutalist). */
export function panelStyle(t: ThemeTokens): CSSProperties {
  return {
    background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6',
    border: t.cardBorder !== 'none' ? t.cardBorder : `1px solid ${t.ruleColor}`,
    borderRadius: t.cardRadius,
    boxShadow: t.cardShadow !== 'none' ? t.cardShadow : 'none',
  }
}

export function headingStyle(t: ThemeTokens): CSSProperties {
  return {
    fontFamily: t.headerFont,
    color: t.ink,
    textTransform: t.headerTransform,
    letterSpacing: t.headerSpacing,
  }
}

export function sectionTitleStyle(t: ThemeTokens): CSSProperties {
  return {
    fontFamily: t.titleFont,
    color: t.ink,
    textTransform: t.titleTransform,
    fontWeight: t.titleWeight,
    letterSpacing: t.titleSpacing,
  }
}

export function bodyStyle(t: ThemeTokens): CSSProperties {
  return { fontFamily: t.descFont, color: t.descColor }
}

/** Whether the active theme is the hard-edged (brutalist/hybrid) family. */
export function isHard(t: ThemeTokens): boolean {
  return t.navStyle === 'underline'
}

export function controlRadius(t: ThemeTokens): number {
  return isHard(t) ? 0 : 10
}
