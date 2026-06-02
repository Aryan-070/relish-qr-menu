import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Upload, Video, X } from 'lucide-react'
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
import { fileToDataUrl } from './readFile'

/** Local draft shape: arrays are edited as comma-separated strings. */
interface Draft {
  name: string
  price: number
  categoryId: string
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
  }
}

/** Controlled menu item form for the create/edit Drawer. Commits only on Save. */
export function MenuItemForm({ item, mode, onCommit, registerSubmit }: MenuItemFormProps) {
  const { tokens: t } = useTheme()
  const [draft, setDraft] = useState<Draft>(() => seedDraft(item))
  const [touched, setTouched] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const radius = controlRadius(t)
  const hard = isHard(t)

  // Re-seed when the Drawer is reused for a different item.
  useEffect(() => {
    setDraft(seedDraft(item))
    setTouched(false)
  }, [item])

  const nameError = draft.name.trim().length === 0
  const priceError = !Number.isFinite(draft.price) || draft.price < 0

  useEffect(() => {
    const submit = () => {
      setTouched(true)
      if (draft.name.trim().length === 0) return
      if (!Number.isFinite(draft.price) || draft.price < 0) return
      onCommit({
        ...item,
        name: draft.name.trim(),
        price: Math.round(draft.price),
        categoryId: draft.categoryId,
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
