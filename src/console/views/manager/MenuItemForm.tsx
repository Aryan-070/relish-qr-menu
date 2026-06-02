import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Image as ImageIcon, Plus, Upload, Video, X } from 'lucide-react'
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from '../../components/Field'
import { SegmentedControl } from '../../components/SegmentedControl'
import { useTheme } from '../../../theme/ThemeContext'
import { controlRadius, isHard } from '../../lib/skin'
import { LqipImage } from '../../../components/atoms/LqipImage'
import { categories } from '../../../data/menu'
import { MENU_BADGES } from '../../lib/types'
import type { EditableMenuItem } from '../../lib/types'
import type { ModifierGroup, ModifierOption } from '../../../data/modifiers'
import { GST_RATES, DEFAULT_GST_RATE_PCT } from '../../../lib/tax'
import { fileToDataUrl } from './readFile'

/** Local draft shape: arrays are edited as comma-separated strings. */
interface Draft {
  name: string
  price: number
  categoryId: string
  taxRatePct: number
  description: string
  tagsText: string
  customizationsText: string
  spiceLevel: 0 | 1 | 2 | 3
  isJain: boolean
  canBeJain: boolean
  chefsSpecial: boolean
  available: boolean
  soldOut: boolean
  imageUrl: string
  videoUrl: string
  badges: string[]
  modifierGroups: ModifierGroup[]
}

interface MenuItemFormProps {
  /** The seed item (blank for create, existing for edit). */
  item: EditableMenuItem
  /** Whether this is an edit (vs create) — drives copy + commit action. */
  mode: 'create' | 'edit'
  /** Commit the validated patch. Parent decides create vs update. */
  onCommit: (patch: EditableMenuItem) => void
  /** Register the validated submit handler so the Drawer footer can call it. */
  registerSubmit: (submit: () => void) => void
}

const SPICE_OPTIONS: Array<{ value: '0' | '1' | '2' | '3'; label: string }> = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Mild' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Hot' },
]

const CATEGORY_OPTIONS = categories.map(c => ({ value: c.id, label: c.name }))

/** GST slab options, keyed by percentage as a string for the Select. */
const TAX_RATE_OPTIONS = GST_RATES.map(r => ({ value: String(r.pct), label: r.label }))

function toCsv(values: string[]): string {
  return values.join(', ')
}

function fromCsv(text: string): string[] {
  return text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function seedDraft(item: EditableMenuItem): Draft {
  return {
    name: item.name,
    price: item.price,
    categoryId: item.categoryId,
    taxRatePct: item.taxRatePct ?? DEFAULT_GST_RATE_PCT,
    description: item.description,
    tagsText: toCsv(item.tags),
    customizationsText: toCsv(item.customizations),
    spiceLevel: item.spiceLevel,
    isJain: item.isJain,
    canBeJain: item.canBeJain,
    chefsSpecial: item.chefsSpecial,
    available: item.available,
    soldOut: item.soldOut,
    imageUrl: item.imageUrl ?? '',
    videoUrl: item.videoUrl ?? '',
    badges: item.badges ?? [],
    modifierGroups: cloneGroups(item.modifierGroups),
  }
}

/** Deep-clone groups so editing the draft never mutates the source item. */
function cloneGroups(groups: ModifierGroup[] | undefined): ModifierGroup[] {
  return (groups ?? []).map(g => ({
    ...g,
    options: g.options.map(o => ({ ...o })),
  }))
}

let modifierSeq = 0
function newId(prefix: string): string {
  modifierSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${modifierSeq}`
}

/** Controlled menu item form for the create/edit Drawer. Commits only on Save. */
export function MenuItemForm({ item, mode, onCommit, registerSubmit }: MenuItemFormProps) {
  const { tokens: t } = useTheme()
  const [draft, setDraft] = useState<Draft>(() => seedDraft(item))
  const [touched, setTouched] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [modifiersOpen, setModifiersOpen] = useState(() => (item.modifierGroups?.length ?? 0) > 0)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const radius = controlRadius(t)
  const hard = isHard(t)

  // Re-seed when the Drawer is reused for a different item.
  useEffect(() => {
    setDraft(seedDraft(item))
    setTouched(false)
    setModifiersOpen((item.modifierGroups?.length ?? 0) > 0)
  }, [item])

  const nameError = draft.name.trim().length === 0
  const priceError = !Number.isFinite(draft.price) || draft.price < 0

  useEffect(() => {
    const submit = () => {
      setTouched(true)
      if (draft.name.trim().length === 0) return
      if (!Number.isFinite(draft.price) || draft.price < 0) return
      // Keep only groups that have a name and at least one option; omit the
      // field entirely when empty so the guest flow falls back to showcase/derived.
      const cleanedGroups = draft.modifierGroups
        .map(g => ({ ...g, name: g.name.trim(), options: g.options.filter(o => o.label.trim().length > 0) }))
        .filter(g => g.name.length > 0 && g.options.length > 0)
      onCommit({
        ...item,
        name: draft.name.trim(),
        price: Math.round(draft.price),
        categoryId: draft.categoryId,
        taxRatePct: draft.taxRatePct,
        description: draft.description.trim(),
        tags: fromCsv(draft.tagsText),
        customizations: fromCsv(draft.customizationsText),
        spiceLevel: draft.spiceLevel,
        isJain: draft.isJain,
        canBeJain: draft.canBeJain,
        chefsSpecial: draft.chefsSpecial,
        available: draft.available,
        soldOut: draft.soldOut,
        imageUrl: draft.imageUrl.trim() || undefined,
        videoUrl: draft.videoUrl.trim() || undefined,
        badges: draft.badges,
        modifierGroups: cleanedGroups.length > 0 ? cleanedGroups : undefined,
      })
    }
    registerSubmit(submit)
  }, [draft, item, onCommit, registerSubmit])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const toggleBadge = (badge: string) =>
    setDraft(prev => ({
      ...prev,
      badges: prev.badges.includes(badge)
        ? prev.badges.filter(b => b !== badge)
        : [...prev.badges, badge],
    }))

  // ── Modifier group editing (all immutable updates) ────────────────────────
  const addGroup = () =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: [
        ...prev.modifierGroups,
        { id: newId('grp'), name: 'New group', min: 1, max: 1, options: [] },
      ],
    }))

  const removeGroup = (groupId: string) =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.filter(g => g.id !== groupId),
    }))

  const patchGroup = (groupId: string, patch: Partial<Omit<ModifierGroup, 'id' | 'options'>>) =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map(g => (g.id === groupId ? { ...g, ...patch } : g)),
    }))

  const addOption = (groupId: string) =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map(g =>
        g.id === groupId
          ? { ...g, options: [...g.options, { id: newId('opt'), label: '', priceDelta: 0 }] }
          : g,
      ),
    }))

  const removeOption = (groupId: string, optionId: string) =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map(g =>
        g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g,
      ),
    }))

  const patchOption = (groupId: string, optionId: string, patch: Partial<Omit<ModifierOption, 'id'>>) =>
    setDraft(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map(g =>
        g.id === groupId
          ? { ...g, options: g.options.map(o => (o.id === optionId ? { ...o, ...patch } : o)) }
          : g,
      ),
    }))

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return
    setMediaError(null)
    try {
      const url = await fileToDataUrl(file)
      set('imageUrl', url)
    } catch {
      setMediaError('Could not use that image (max 2 MB).')
    }
  }

  const handleVideoFile = async (file: File | undefined) => {
    if (!file) return
    setMediaError(null)
    try {
      const url = await fileToDataUrl(file, 8_000_000)
      set('videoUrl', url)
    } catch {
      setMediaError('Could not use that video (max 8 MB).')
    }
  }

  const uploadBtnClass = 'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon'
  const uploadBtnStyle = {
    borderRadius: radius,
    border: `1px solid ${t.ruleColor}`,
    background: '#FFFFFF',
    color: t.ink,
    fontFamily: t.descFont,
  } as const

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => e.preventDefault()}
      aria-label={mode === 'create' ? 'Create menu item' : 'Edit menu item'}
    >
      <TextField
        label="Name"
        value={draft.name}
        onChange={v => set('name', v)}
        placeholder="e.g. Garden Pesto Penne"
        hint={touched && nameError ? 'Name is required.' : undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Price"
          value={draft.price}
          onChange={v => set('price', v)}
          prefix="₹"
          min={0}
          hint={touched && priceError ? 'Price must be ≥ 0.' : undefined}
        />
        <SelectField
          label="Category"
          value={draft.categoryId}
          onChange={v => set('categoryId', v)}
          options={CATEGORY_OPTIONS}
        />
      </div>

      <SelectField
        label="Tax rate (GST)"
        value={String(draft.taxRatePct)}
        onChange={v => set('taxRatePct', Number(v))}
        options={TAX_RATE_OPTIONS}
      />

      <TextAreaField
        label="Description"
        value={draft.description}
        onChange={v => set('description', v)}
        rows={3}
        placeholder="Short, appetising one-liner."
      />

      {/* Media: photo + video */}
      <div className="flex flex-col gap-3 pt-1">
        <span
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: t.inkSoft, fontFamily: t.descFont }}
        >
          Media
        </span>

        <div className="flex gap-3">
          {/* Photo preview */}
          {draft.imageUrl ? (
            <LqipImage
              src={draft.imageUrl}
              alt="Item photo preview"
              wrapperClassName="shrink-0"
              wrapperStyle={{ width: 88, height: 88, borderRadius: radius }}
              imgClassName="w-full h-full object-cover"
            />
          ) : (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 88,
                height: 88,
                borderRadius: radius,
                border: `1px dashed ${t.ruleColor}`,
                color: t.descColor,
                background: 'rgba(0,0,0,0.015)',
              }}
              aria-hidden
            >
              <ImageIcon size={22} />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <TextField
              label="Photo URL"
              value={draft.imageUrl}
              onChange={v => set('imageUrl', v)}
              placeholder="/assets/dishes/… or https://…"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                aria-label="Upload photo file"
                className="hidden"
                onChange={e => {
                  void handlePhotoFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className={uploadBtnClass}
                style={uploadBtnStyle}
                onClick={() => photoInputRef.current?.click()}
                aria-label="Upload photo"
              >
                <Upload size={14} aria-hidden /> Upload photo
              </button>
              {draft.imageUrl && (
                <button
                  type="button"
                  className={uploadBtnClass}
                  style={uploadBtnStyle}
                  onClick={() => set('imageUrl', '')}
                  aria-label="Remove photo"
                >
                  <X size={14} aria-hidden /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Video */}
        <div className="flex gap-3">
          {draft.videoUrl ? (
            <video
              src={draft.videoUrl}
              className="shrink-0 object-cover"
              style={{ width: 88, height: 88, borderRadius: radius, background: '#000' }}
              playsInline
              muted
              loop
              autoPlay
              aria-label="Item video preview"
            />
          ) : (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 88,
                height: 88,
                borderRadius: radius,
                border: `1px dashed ${t.ruleColor}`,
                color: t.descColor,
                background: 'rgba(0,0,0,0.015)',
              }}
              aria-hidden
            >
              <Video size={22} />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <TextField
              label="Video URL"
              value={draft.videoUrl}
              onChange={v => set('videoUrl', v)}
              placeholder="https://… or upload a clip"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                aria-label="Upload video file"
                className="hidden"
                onChange={e => {
                  void handleVideoFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className={uploadBtnClass}
                style={uploadBtnStyle}
                onClick={() => videoInputRef.current?.click()}
                aria-label="Upload video"
              >
                <Upload size={14} aria-hidden /> Upload video
              </button>
              {draft.videoUrl && (
                <button
                  type="button"
                  className={uploadBtnClass}
                  style={uploadBtnStyle}
                  onClick={() => set('videoUrl', '')}
                  aria-label="Remove video"
                >
                  <X size={14} aria-hidden /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {mediaError && (
          <span className="text-[11px]" style={{ color: t.accent, fontFamily: t.descFont }}>
            {mediaError}
          </span>
        )}
      </div>

      <TextField
        label="Tags"
        value={draft.tagsText}
        onChange={v => set('tagsText', v)}
        placeholder="comma, separated, tags"
        hint="Comma-separated."
      />

      <TextField
        label="Customizations"
        value={draft.customizationsText}
        onChange={v => set('customizationsText', v)}
        placeholder="Extra cheese, No onion"
        hint="Comma-separated."
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mute,#a89a8a)' }}>
          Spice level
        </span>
        <SegmentedControl
          options={SPICE_OPTIONS}
          value={String(draft.spiceLevel) as '0' | '1' | '2' | '3'}
          onChange={v => set('spiceLevel', Number(v) as 0 | 1 | 2 | 3)}
          ariaLabel="Spice level"
          size="sm"
        />
      </div>

      {/* Badges */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: t.inkSoft, fontFamily: t.descFont }}
        >
          Badges
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Item badges">
          {MENU_BADGES.map(badge => {
            const active = draft.badges.includes(badge)
            return (
              <button
                key={badge}
                type="button"
                aria-pressed={active}
                onClick={() => toggleBadge(badge)}
                className="inline-flex items-center px-3 text-[12px] font-semibold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon"
                style={{
                  minHeight: 32,
                  borderRadius: hard ? 0 : 999,
                  fontFamily: t.descFont,
                  color: active ? '#FFFFFF' : t.ink,
                  background: active ? t.accent : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${active ? t.accent : t.ruleColor}`,
                }}
              >
                {badge}
              </button>
            )
          })}
        </div>
      </div>

      {/* Modifiers (collapsible) */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={() => setModifiersOpen(o => !o)}
          aria-expanded={modifiersOpen}
          className="flex items-center justify-between w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon"
          style={{ borderRadius: radius }}
        >
          <span
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: t.inkSoft, fontFamily: t.descFont }}
          >
            Modifiers{draft.modifierGroups.length > 0 ? ` (${draft.modifierGroups.length})` : ''}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            style={{
              color: t.descColor,
              transition: 'transform 160ms ease',
              transform: modifiersOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </button>

        {modifiersOpen && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
              Add-on groups with per-option ₹ upcharges. Each group has a min/max number of
              selectable options. These override the auto-derived options on the live menu.
            </p>

            {draft.modifierGroups.map(group => (
              <div
                key={group.id}
                className="flex flex-col gap-3 p-3"
                style={{
                  borderRadius: radius,
                  border: `1px solid ${t.ruleColor}`,
                  background: 'rgba(0,0,0,0.015)',
                }}
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <TextField
                      label="Group name"
                      value={group.name}
                      onChange={v => patchGroup(group.id, { name: v })}
                      placeholder="e.g. Choose your crust"
                    />
                  </div>
                  <button
                    type="button"
                    className={uploadBtnClass}
                    style={uploadBtnStyle}
                    onClick={() => removeGroup(group.id)}
                    aria-label={`Remove group ${group.name || 'group'}`}
                  >
                    <X size={14} aria-hidden /> Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Min select"
                    value={group.min}
                    onChange={v => patchGroup(group.id, { min: Math.max(0, Math.round(v) || 0) })}
                    min={0}
                  />
                  <NumberField
                    label="Max select"
                    value={group.max}
                    onChange={v => patchGroup(group.id, { max: Math.max(1, Math.round(v) || 1) })}
                    min={1}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: t.inkSoft, fontFamily: t.descFont }}
                  >
                    Options
                  </span>
                  {group.options.length === 0 && (
                    <p className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                      No options yet — add one below.
                    </p>
                  )}
                  {group.options.map(option => (
                    <div key={option.id} className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <TextField
                          label="Label"
                          value={option.label}
                          onChange={v => patchOption(group.id, option.id, { label: v })}
                          placeholder="e.g. Extra cheese"
                        />
                      </div>
                      <div className="w-[110px] shrink-0">
                        <NumberField
                          label="₹ delta"
                          value={option.priceDelta}
                          onChange={v => patchOption(group.id, option.id, { priceDelta: Math.round(v) || 0 })}
                          prefix="₹"
                          min={0}
                        />
                      </div>
                      <button
                        type="button"
                        className={uploadBtnClass}
                        style={uploadBtnStyle}
                        onClick={() => removeOption(group.id, option.id)}
                        aria-label={`Remove option ${option.label || 'option'}`}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className={uploadBtnClass}
                      style={uploadBtnStyle}
                      onClick={() => addOption(group.id)}
                      aria-label={`Add option to ${group.name || 'group'}`}
                    >
                      <Plus size={14} aria-hidden /> Add option
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div>
              <button
                type="button"
                className={uploadBtnClass}
                style={uploadBtnStyle}
                onClick={addGroup}
                aria-label="Add modifier group"
              >
                <Plus size={14} aria-hidden /> Add modifier group
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <ToggleField
          label="Chef's special"
          description="Highlight as a signature pick."
          checked={draft.chefsSpecial}
          onChange={v => set('chefsSpecial', v)}
        />
        <ToggleField
          label="Jain"
          description="No onion, garlic, or root vegetables."
          checked={draft.isJain}
          onChange={v => set('isJain', v)}
        />
        <ToggleField
          label="Can be made Jain"
          description="Offer a Jain preparation on request."
          checked={draft.canBeJain}
          onChange={v => set('canBeJain', v)}
        />
        <ToggleField
          label="Available"
          description="Show this item on the live menu."
          checked={draft.available}
          onChange={v => set('available', v)}
        />
        <ToggleField
          label="Sold out"
          description="Temporarily mark as 86'd."
          checked={draft.soldOut}
          onChange={v => set('soldOut', v)}
        />
      </div>
    </form>
  )
}
