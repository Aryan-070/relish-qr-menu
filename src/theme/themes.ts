// Tri-theme UI system: warm (refined fine-dining), hybrid (refined-brutalist),
// brutalist (full editorial). One component contract, three skins — selected at runtime.

export type UiTheme = 'warm' | 'hybrid' | 'brutalist' | 'editorial'

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
  accent2: string // secondary accent (sage in editorial; mirrors `accent` elsewhere)
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
  // optional CSS `filter` applied to all video/poster media so footage sits in
  // the theme's palette (editorial = warm grade). Omitted → no grade.
  videoFilter?: string
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
const SATOSHI = "'Satoshi', system-ui, sans-serif"       // editorial UI / nav / pills (Fontshare)
const GENERAL = "'General Sans', system-ui, sans-serif"  // editorial body / description (Fontshare)
const GEIST_MONO = "'Geist Mono', 'JetBrains Mono', monospace" // editorial price / numerals

export const THEMES: Record<UiTheme, ThemeTokens> = {
  warm: {
    pill: { radius: 999, font: HANKEN, transform: 'uppercase', bracket: false, monochrome: false, monoInk: '#2A1E1E' },
    label: 'Warm',
    bg: '#FFF8EA',
    cardBg: '#FFF8EA',
    ink: '#2A1E1E',
    inkSoft: '#5b4a44',
    accent: '#8B1024',
    accent2: '#8B1024',
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
    accent2: '#8B1024',
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
    accent2: '#8B1024',
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
  // 2026 editorial direction — Cloud-Dancer cream + terracotta/sage/espresso,
  // serif-forward (Fraunces) with a modern grotesque body (General Sans / Satoshi).
  // Saturation kept <80%, no pure black, terracotta-tinted diffusion shadow.
  editorial: {
    pill: { radius: 999, font: SATOSHI, transform: 'uppercase', bracket: false, monochrome: false, monoInk: '#1F1C18' },
    label: 'Editorial',
    bg: '#F2EFE8',
    cardBg: '#F8F5EF',
    ink: '#1F1C18',
    inkSoft: '#5A4F45',
    accent: '#B85C44',
    accent2: '#8A9A7B',
    cardRadius: 20,
    cardBorder: '1px solid #E3D9CA',
    cardShadow: '0 6px 28px rgba(184,92,68,0.07)',
    cardSeparator: 'shadow',
    ruleColor: '#E3D9CA',
    thumbRadius: 16,
    thumbBorder: '1px solid #E3D9CA',
    titleFont: FRAUNCES,
    titleTransform: 'none',
    titleWeight: 600,
    titleSize: 16.5,
    titleSpacing: '-0.01em',
    descFont: GENERAL,
    descColor: '#5A4F45',
    accentFont: INSTRUMENT,
    priceFont: GEIST_MONO,
    priceWeight: 600,
    priceSize: 14.5,
    priceColor: '#B85C44',
    addShape: 'pill',
    addLabel: '+',
    headerFont: FRAUNCES,
    headerTransform: 'none',
    headerSize: 30,
    headerColor: '#1F1C18',
    headerSpacing: '-0.02em',
    navStyle: 'pill',
    videoFilter: 'saturate(1.06) contrast(1.02) brightness(1.02) sepia(0.08)',
  },
}

export const THEME_ORDER: UiTheme[] = ['warm', 'hybrid', 'brutalist', 'editorial']

// ── shadcn / Cult UI / Watermelon token bridge ──────────────────────────────
// Derive the shadcn CSS-variable set from a theme's tokens. Injected onto :root
// at runtime by ThemeProvider so library components (in-shell AND Radix portals,
// which mount on document.body) inherit the active skin. themes.ts stays the
// single source of truth — these vars are NOT hand-mirrored in CSS.
export function shadcnVars(t: ThemeTokens): Record<string, string> {
  return {
    '--background': t.bg,
    '--foreground': t.ink,
    '--card': t.cardBg,
    '--card-foreground': t.ink,
    '--popover': t.cardBg,
    '--popover-foreground': t.ink,
    '--primary': t.accent,
    '--primary-foreground': t.bg,
    '--secondary': t.bg,
    '--secondary-foreground': t.ink,
    '--muted': t.bg,
    '--muted-foreground': t.inkSoft,
    '--accent': t.bg,
    '--accent-foreground': t.ink,
    '--destructive': '#D71920',
    '--destructive-foreground': '#FFFFFF',
    '--border': t.ruleColor,
    '--input': t.ruleColor,
    '--ring': t.accent,
    '--radius': `${t.cardRadius}px`,
  }
}
