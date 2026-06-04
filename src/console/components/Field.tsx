import { useId, type ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// White input surface reads clearer than the cream paper on console panels.
const FIELD_CLS = 'w-full bg-white text-[14px]'

interface LabelWrapProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}
function LabelWrap({ label, htmlFor, hint, children }: LabelWrapProps) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-[12px] font-semibold uppercase tracking-wider"
        style={{ fontFamily: t.descFont, color: t.inkSoft }}
      >
        {label}
      </Label>
      {children}
      {hint && <span className="text-[11px]" style={{ color: 'var(--mute,#a89a8a)' }}>{hint}</span>}
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  type?: 'text' | 'number' | 'tel' | 'email'
}
export function TextField({ label, value, onChange, placeholder, hint, type = 'text' }: TextFieldProps) {
  const id = useId()
  return (
    <LabelWrap label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={FIELD_CLS}
      />
    </LabelWrap>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  prefix?: string
  hint?: string
}
export function NumberField({ label, value, onChange, min = 0, prefix, hint }: NumberFieldProps) {
  const id = useId()
  const { tokens: t } = useTheme()
  return (
    <LabelWrap label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        {prefix && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]"
            style={{ color: t.inkSoft }}
          >
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          min={min}
          value={Number.isFinite(value) ? value : ''}
          onChange={e => onChange(Number(e.target.value))}
          className={cnWidth(prefix)}
        />
      </div>
    </LabelWrap>
  )
}
function cnWidth(prefix?: string) {
  return prefix ? `${FIELD_CLS} pl-7` : FIELD_CLS
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}
export function TextAreaField({ label, value, onChange, rows = 3, placeholder }: TextAreaFieldProps) {
  const id = useId()
  return (
    <LabelWrap label={label} htmlFor={id}>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`${FIELD_CLS} resize-none leading-relaxed`}
      />
    </LabelWrap>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}
// Radix <Select.Item> forbids an empty-string value (it reserves "" to clear the
// selection). Several option sets legitimately use "" for an "unassigned / none"
// choice, so map "" to a sentinel for Radix and translate it back on change.
const EMPTY_OPTION = '__empty__'
const toRadix = (v: string) => (v === '' ? EMPTY_OPTION : v)
const fromRadix = (v: string) => (v === EMPTY_OPTION ? '' : v)

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId()
  return (
    <LabelWrap label={label} htmlFor={id}>
      <Select value={toRadix(value)} onValueChange={v => onChange(fromRadix(v))}>
        <SelectTrigger id={id} className="w-full bg-white text-[14px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={toRadix(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LabelWrap>
  )
}

interface ToggleFieldProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}
export function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-[13px] font-semibold" style={{ fontFamily: t.descFont, color: t.ink }}>
          {label}
        </span>
        {description && (
          <span className="block text-[11px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
            {description}
          </span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
