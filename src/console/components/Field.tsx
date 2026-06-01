import { useId, type ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { controlRadius } from '../lib/skin'
import { cn } from '../lib/format'

function useFieldStyle() {
  const { tokens: t } = useTheme()
  return {
    input: {
      borderRadius: controlRadius(t),
      border: `1px solid ${t.ruleColor}`,
      background: '#FFFFFF',
      color: t.ink,
      fontFamily: t.descFont,
    } as const,
    label: { fontFamily: t.descFont, color: t.inkSoft } as const,
    accent: t.accent,
  }
}

interface LabelWrapProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}
function LabelWrap({ label, htmlFor, hint, children }: LabelWrapProps) {
  const s = useFieldStyle()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold uppercase tracking-wider" style={s.label}>
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px]" style={{ color: 'var(--mute,#a89a8a)' }}>{hint}</span>}
    </div>
  )
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon'

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  type?: 'text' | 'number'
}
export function TextField({ label, value, onChange, placeholder, hint, type = 'text' }: TextFieldProps) {
  const id = useId()
  const s = useFieldStyle()
  return (
    <LabelWrap label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={cn('px-3 py-2 text-[14px] w-full', FOCUS)}
        style={s.input}
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
  const s = useFieldStyle()
  return (
    <LabelWrap label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center px-3 py-2 w-full" style={s.input}>
        {prefix && <span className="text-[14px] mr-1" style={{ color: s.label.color }}>{prefix}</span>}
        <input
          id={id}
          type="number"
          min={min}
          value={Number.isFinite(value) ? value : ''}
          onChange={e => onChange(Number(e.target.value))}
          className={cn('text-[14px] w-full bg-transparent', FOCUS)}
          style={{ color: s.input.color, fontFamily: s.input.fontFamily }}
        />
      </div>
    </LabelWrap>
  )
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
  const s = useFieldStyle()
  return (
    <LabelWrap label={label} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={cn('px-3 py-2 text-[14px] w-full resize-none leading-relaxed', FOCUS)}
        style={s.input}
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
export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId()
  const s = useFieldStyle()
  return (
    <LabelWrap label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn('px-3 py-2 text-[14px] w-full cursor-pointer', FOCUS)}
        style={s.input}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 w-full text-left cursor-pointer"
    >
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
      <span
        className="relative w-10 h-6 rounded-full shrink-0 transition-colors"
        style={{ background: checked ? t.accent : 'rgba(42,30,30,0.18)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
        />
      </span>
    </button>
  )
}
