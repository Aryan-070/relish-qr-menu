/** The consumer landing/cover designs. Shared by the demo route's switcher and
 *  the admin Appearance panel (the chosen variant is stored per restaurant). */
export type LandingVariant =
  | 'classic'
  | 'gastronomique'
  | 'editorial'
  | 'botanica'
  | 'signature'
  | 'cinematic'
  | 'reel'

export const VARIANTS: Array<{ id: LandingVariant; label: string }> = [
  { id: 'signature', label: 'Signature' },
  { id: 'classic', label: 'Classic' },
  { id: 'gastronomique', label: 'Deco' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'botanica', label: 'Botanica' },
  { id: 'cinematic', label: 'Cinema' },
  { id: 'reel', label: 'Reel' },
]

export const DEFAULT_LANDING_VARIANT: LandingVariant = 'reel'
