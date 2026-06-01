// Tri-theme UI system: warm (refined fine-dining), hybrid (refined-brutalist),
// brutalist (full editorial). One component contract, three skins — selected at runtime.

export type UiTheme = 'warm' | 'hybrid' | 'brutalist'

// Dietary / tag / chef / spice pill styling — theme-aware so the chips read
// soft & rounded in warm, hard-edged & monospaced in hybrid/brutalist.
export interface PillTokens {
  radius: number
  font: string
  transform: 'none' | 'uppercase'
  bracket: boolean // wrap label as [ LABEL ] (terminal/brutalist look)
  monochrome: boolean // ignore semantic hues; render every pill in ink
  monoInk: string // ink used when monochrome
}

export interface ThemeTokens {
  pill: PillTokens
  label: string
  // surfaces
  bg: string
  cardBg: string
  ink: string
  inkSoft: string
  accent: string // maroon primary
  // card frame
  cardRadius: number
  cardBorder: string
  cardShadow: string
  cardSeparator: 'shadow' | 'rule' // rule → hairline divider list, no per-card shadow
  ruleColor: string
  thumbRadius: number
  thumbBorder: string
  // item title
  titleFont: string
  titleTransform: 'none' | 'uppercase'
  titleWeight: number
  titleSize: number
  titleSpacing: string
  // description
  descFont: string
  descColor: string
  // accent (taglines, editorial notes, active category label)
  accentFont: string
  // price
  priceFont: string
  priceWeight: number
  priceSize: number
  priceColor: string
  // add affordance
  addShape: 'pill' | 'square'
  addLabel: string
  // category header
  headerFont: string
  headerTransform: 'none' | 'uppercase'
  headerSize: number
  headerColor: string
  headerSpacing: string
  // nav
  navStyle: 'pill' | 'underline'
}

// 2026 type system (research-vetted, all on Google Fonts)
const FRAUNCES = "'Fraunces', Georgia, serif"            // warm display
const HANKEN = "'Hanken Grotesk', system-ui, sans-serif" // warm body
const INSTRUMENT = "'Instrument Serif', Georgia, serif"  // warm accent
const BRICOLAGE = "'Bricolage Grotesque', Arial, sans-serif" // hybrid display
const DMSERIF = "'DM Serif Display', Georgia, serif"     // hybrid header serif
const MARTIAN = "'Martian Mono', 'Courier New', monospace"   // hybrid mono
const SYNE = "'Syne', Arial, sans-serif"                 // brutalist display
const JETBRAINS = "'JetBrains Mono', 'Courier New', monospace" // brutalist body/mono

export const THEMES: Record<UiTheme, ThemeTokens> = {
  warm: {
    pill: { radius: 999, font: HANKEN, transform: 'uppercase', bracket: false, monochrome: false, monoInk: '#2A1E1E' },
    label: 'Warm',
    bg: '#FFF8EA',
    cardBg: '#FFF8EA',
    ink: '#2A1E1E',
    inkSoft: '#5b4a44',
    accent: '#8B1024',
    cardRadius: 16,
    cardBorder: '1px solid rgba(217,160,58,0.25)',
    cardShadow: '0 2px 12px rgba(42,30,30,0.08)',
    cardSeparator: 'shadow',
    ruleColor: 'rgba(42,30,30,0.12)',
    thumbRadius: 12,
    thumbBorder: '1px solid rgba(217,160,58,0.28)',
    titleFont: FRAUNCES,
    titleTransform: 'none',
    titleWeight: 600,
    titleSize: 16,
    titleSpacing: '-0.005em',
    descFont: HANKEN,
    descColor: '#5b4a44',
    accentFont: INSTRUMENT,
    priceFont: HANKEN,
    priceWeight: 700,
    priceSize: 15,
    priceColor: '#8B1024',
    addShape: 'pill',
    addLabel: '+',
    headerFont: FRAUNCES,
    headerTransform: 'none',
    headerSize: 28,
    headerColor: '#8B1024',
    headerSpacing: '-0.018em',
    navStyle: 'pill',
  },
  hybrid: {
    pill: { radius: 0, font: MARTIAN, transform: 'uppercase', bracket: true, monochrome: false, monoInk: '#2A1E1E' },
    label: 'Hybrid',
    bg: '#FFF8EA',
    cardBg: '#FFF8EA',
    ink: '#2A1E1E',
    inkSoft: '#4a3f3a',
    accent: '#8B1024',
    cardRadius: 0,
    cardBorder: 'none',
    cardShadow: 'none',
    cardSeparator: 'rule',
    ruleColor: 'rgba(42,30,30,0.16)',
    thumbRadius: 0,
    thumbBorder: '1px solid rgba(42,30,30,0.14)',
    titleFont: BRICOLAGE,
    titleTransform: 'uppercase',
    titleWeight: 800,
    titleSize: 14,
    titleSpacing: '-0.01em',
    descFont: MARTIAN,
    descColor: '#5b4a44',
    accentFont: DMSERIF,
    priceFont: MARTIAN,
    priceWeight: 600,
    priceSize: 15,
    priceColor: '#8B1024',
    addShape: 'square',
    addLabel: '+ ADD',
    headerFont: DMSERIF,
    headerTransform: 'none',
    headerSize: 32,
    headerColor: '#8B1024',
    headerSpacing: '-0.01em',
    navStyle: 'underline',
  },
  brutalist: {
    pill: { radius: 0, font: JETBRAINS, transform: 'uppercase', bracket: true, monochrome: true, monoInk: '#111111' },
    label: 'Brutal',
    bg: '#F4F4F0',
    cardBg: '#F4F4F0',
    ink: '#111111',
    inkSoft: '#444444',
    accent: '#8B1024',
    cardRadius: 0,
    cardBorder: 'none',
    cardShadow: 'none',
    cardSeparator: 'rule',
    ruleColor: '#111111',
    thumbRadius: 0,
    thumbBorder: '1px solid #111111',
    titleFont: SYNE,
    titleTransform: 'uppercase',
    titleWeight: 800,
    titleSize: 13.5,
    titleSpacing: '-0.01em',
    descFont: JETBRAINS,
    descColor: '#444444',
    accentFont: JETBRAINS,
    priceFont: JETBRAINS,
    priceWeight: 700,
    priceSize: 14.5,
    priceColor: '#8B1024',
    addShape: 'square',
    addLabel: '+ ADD',
    headerFont: SYNE,
    headerTransform: 'uppercase',
    headerSize: 30,
    headerColor: '#111111',
    headerSpacing: '-0.015em',
    navStyle: 'underline',
  },
}

export const THEME_ORDER: UiTheme[] = ['warm', 'hybrid', 'brutalist']
