import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Palette } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { THEME_ORDER, THEMES, type UiTheme } from '../../theme/themes'
import { useApplyThemeConfig } from '../../theme/useThemeConfig'
import { VARIANTS, type LandingVariant } from '../../data/landingVariants'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { TextField, SelectField } from '../components/Field'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/api/client'
import {
  getThemeConfig,
  putThemeConfig,
  type ThemeConfig,
  type ThemeConfigPatch,
  type UiThemeKey,
} from '../../lib/api/themeConfig'

const THEME_KEY = ['theme-config']

// Curated families already loaded by index.html (Google Fonts + Fontshare).
const FONT_OPTIONS = [
  { value: '', label: 'Theme default' },
  { value: 'Fraunces', label: 'Fraunces (serif)' },
  { value: 'Playfair Display', label: 'Playfair Display (serif)' },
  { value: 'Lora', label: 'Lora (serif)' },
  { value: 'Cormorant Garamond', label: 'Cormorant (serif)' },
  { value: 'Hanken Grotesk', label: 'Hanken Grotesk (sans)' },
  { value: 'Inter', label: 'Inter (sans)' },
  { value: 'Satoshi', label: 'Satoshi (sans)' },
  { value: 'Syne', label: 'Syne (display)' },
]

const THEME_ABOUT: Record<UiTheme, string> = {
  warm: 'Refined fine-dining — cream paper, deep maroon, serif headlines. Timeless and inviting.',
  hybrid: 'Brutalist-refined hybrid — cream base with hard edges and bracketed pills. Modern, confident.',
  brutalist: 'Editorial / terminal — high-contrast monochrome, monospaced type. Bold and graphic.',
  editorial: '2026 editorial — Cloud-Dancer cream with terracotta + sage. Warm, magazine-like.',
  'table-theory': 'QSR café brand — forest green on cream with a serif display. Fresh and grounded.',
}

export function AppearanceSettings() {
  const auth = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const apply = useApplyThemeConfig()
  const { tokens: t } = useTheme()

  const canManage = auth.permissions.includes('manage-theme')
  const query = useQuery({ queryKey: THEME_KEY, queryFn: getThemeConfig, enabled: canManage })

  const [draft, setDraft] = useState<ThemeConfig | null>(null)
  const [previewTheme, setPreviewTheme] = useState<UiTheme | null>(null)

  // Seed the editable draft once the config loads.
  useEffect(() => {
    if (query.data && !draft) setDraft(query.data)
  }, [query.data, draft])

  const save = useMutation({
    mutationFn: (patch: ThemeConfigPatch) => putThemeConfig(patch),
    onSuccess: (cfg) => {
      toast.push('Appearance saved')
      setDraft(cfg)
      qc.invalidateQueries({ queryKey: THEME_KEY })
      apply(cfg) // reflect immediately in the running console
    },
    onError: (e) =>
      toast.push(e instanceof ApiError ? (e.body?.detail ?? e.message) : 'Save failed', 'warn'),
  })

  const patch = useMemo<ThemeConfigPatch | null>(() => {
    if (!draft) return null
    return {
      ui_theme: draft.ui_theme,
      landing_variant: draft.landing_variant,
      brand_colors: draft.brand_colors,
      font_choices: draft.font_choices,
      custom_font: draft.custom_font,
      logo_url: draft.logo_url,
      cover_url: draft.cover_url,
    }
  }, [draft])

  if (!canManage) {
    return (
      <EmptyState
        icon={<Palette size={28} />}
        title="No access"
        description="You need the “manage theme” permission to edit branding."
      />
    )
  }

  if (!draft) {
    return <p className="text-[13px] py-6" style={{ color: t.descColor, fontFamily: t.descFont }}>Loading…</p>
  }

  const set = (p: Partial<ThemeConfig>) => setDraft({ ...draft, ...p })
  const setColor = (k: 'primary' | 'secondary' | 'accent', v: string) =>
    set({ brand_colors: { ...draft.brand_colors, [k]: v } })

  return (
    <div className="flex flex-col gap-4 max-w-[760px]">
      {/* UI theme */}
      <Panel title="Theme" subtitle="The colour + typography system applied across your menu.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {THEME_ORDER.map((key) => {
            const active = draft.ui_theme === key
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <button
                  onClick={() => set({ ui_theme: key as UiThemeKey })}
                  className="rounded-lg p-3 text-left transition-colors"
                  style={{
                    border: `1.5px solid ${active ? t.accent : t.ruleColor}`,
                    background: active ? 'rgba(0,0,0,0.03)' : 'transparent',
                  }}
                >
                  <span className="block text-[13px] font-semibold" style={{ color: t.ink, fontFamily: t.descFont }}>
                    {THEMES[key].label}
                  </span>
                  <span className="flex gap-1 mt-1.5">
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: THEMES[key].bg, border: `1px solid ${t.ruleColor}` }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: THEMES[key].accent }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: THEMES[key].accent2 }} />
                  </span>
                </button>
                <button
                  onClick={() => setPreviewTheme(key)}
                  className="inline-flex items-center gap-1 text-[11px] cursor-pointer"
                  style={{ color: t.accent, fontFamily: t.descFont }}
                >
                  <Eye size={12} /> Preview
                </button>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Landing variant */}
      <Panel title="Landing design" subtitle="The cover screen guests see first.">
        <SelectField
          label="Landing variant"
          value={draft.landing_variant}
          onChange={(v) => set({ landing_variant: v as LandingVariant })}
          options={VARIANTS.map((v) => ({ value: v.id, label: v.label }))}
        />
      </Panel>

      {/* Colours */}
      <Panel title="Brand colours" subtitle="Override the theme’s primary, secondary and accent.">
        <div className="grid grid-cols-3 gap-3">
          <ColorInput label="Primary" value={draft.brand_colors.primary ?? THEMES[draft.ui_theme as UiTheme].accent} onChange={(v) => setColor('primary', v)} />
          <ColorInput label="Secondary" value={draft.brand_colors.secondary ?? THEMES[draft.ui_theme as UiTheme].accent2} onChange={(v) => setColor('secondary', v)} />
          <ColorInput label="Accent" value={draft.brand_colors.accent ?? '#D9A03A'} onChange={(v) => setColor('accent', v)} />
        </div>
      </Panel>

      {/* Fonts */}
      <Panel title="Typography" subtitle="Pick loaded families or import your own font.">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Heading font"
            value={draft.font_choices.heading ?? ''}
            onChange={(v) => set({ font_choices: { ...draft.font_choices, heading: v } })}
            options={FONT_OPTIONS}
          />
          <SelectField
            label="Body font"
            value={draft.font_choices.body ?? ''}
            onChange={(v) => set({ font_choices: { ...draft.font_choices, body: v } })}
            options={FONT_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <TextField
            label="Custom font name"
            value={draft.custom_font.name ?? ''}
            onChange={(v) => set({ custom_font: { ...draft.custom_font, name: v } })}
            placeholder="e.g. AcmeDisplay"
          />
          <TextField
            label="Custom font URL (woff2)"
            value={draft.custom_font.url ?? ''}
            onChange={(v) => set({ custom_font: { ...draft.custom_font, url: v } })}
            placeholder="https://…/font.woff2"
            hint="Pick it as a font above by entering its name."
          />
        </div>
      </Panel>

      {/* Branding */}
      <Panel title="Branding" subtitle="Logo (shown top-left) and a company photo for previews.">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Logo URL" value={draft.logo_url} onChange={(v) => set({ logo_url: v })} placeholder="https://…/logo.png" />
          <TextField label="Company photo URL" value={draft.cover_url} onChange={(v) => set({ cover_url: v })} placeholder="https://…/photo.jpg" />
        </div>
        {draft.logo_url && (
          <img src={draft.logo_url} alt="Logo preview" style={{ height: 36, marginTop: 12, objectFit: 'contain' }} />
        )}
      </Panel>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="subtle" onClick={() => apply(draft)}>Preview live</Button>
        <Button disabled={!patch || save.isPending} onClick={() => patch && save.mutate(patch)}>
          {save.isPending ? 'Saving…' : 'Save & apply'}
        </Button>
      </div>

      <ThemePreviewModal
        themeKey={previewTheme}
        coverUrl={draft.cover_url}
        logoUrl={draft.logo_url}
        onClose={() => setPreviewTheme(null)}
      />
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { tokens: t } = useTheme()
  return (
    <label className="flex flex-col gap-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
      {label}
      <span className="flex items-center gap-2">
        <input type="color" value={normaliseHex(value)} onChange={(e) => onChange(e.target.value)} style={{ width: 40, height: 34, border: `1px solid ${t.ruleColor}`, borderRadius: 6, background: 'none' }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, border: `1px solid ${t.ruleColor}`, borderRadius: 6, padding: '6px 8px', fontFamily: t.descFont, color: t.ink, background: '#fff' }} />
      </span>
    </label>
  )
}

function normaliseHex(v: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000'
}

/** A small live preview of a theme, composed with the restaurant's own photo. */
function ThemePreviewModal({
  themeKey,
  coverUrl,
  logoUrl,
  onClose,
}: {
  themeKey: UiTheme | null
  coverUrl: string
  logoUrl: string
  onClose: () => void
}) {
  if (!themeKey) return null
  const tk = THEMES[themeKey]
  return (
    <Modal open onClose={onClose} title={`${tk.label} — preview`} width={460}>
      <p className="text-[13px] mb-3" style={{ color: tk.descColor, fontFamily: tk.descFont }}>
        {THEME_ABOUT[themeKey]}
      </p>
      <div className="rounded-lg overflow-hidden" style={{ background: tk.bg, border: `1px solid ${tk.ruleColor}` }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: 120, background: tk.accent, opacity: 0.85 }} />
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ height: 22, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontFamily: tk.headerFont, color: tk.headerColor, fontWeight: 700, fontSize: 16 }}>RELISH</span>
            )}
          </div>
          <p style={{ fontFamily: tk.titleFont, color: tk.ink, fontWeight: tk.titleWeight, fontSize: 18 }}>
            Truffle Arancini
          </p>
          <p style={{ fontFamily: tk.descFont, color: tk.descColor, fontSize: 13, marginTop: 2 }}>
            Crisp risotto pearls, aged parmesan, black truffle aioli.
          </p>
          <div className="flex items-center justify-between mt-3">
            <span style={{ fontFamily: tk.priceFont, color: tk.accent, fontWeight: 600 }}>₹420</span>
            <span className="text-[12px] px-3 py-1.5 rounded-full" style={{ background: tk.accent, color: '#fff', fontFamily: tk.descFont }}>
              Add
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
