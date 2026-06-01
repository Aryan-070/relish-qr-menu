import { motion } from 'framer-motion'
import { useId } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'
import { cn } from '../lib/format'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}

/** Pill segmented switch with an animated active indicator (layoutId). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const gid = useId()
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex p-0.5 gap-0.5', className)}
      style={{
        background: 'rgba(42,30,30,0.06)',
        borderRadius: hard ? 0 : 999,
        border: hard ? `1px solid ${t.ruleColor}` : 'none',
      }}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn('relative font-semibold transition-colors cursor-pointer whitespace-nowrap', pad)}
            style={{
              fontFamily: t.descFont,
              color: active ? '#fff' : t.inkSoft,
              textTransform: hard ? 'uppercase' : 'none',
              letterSpacing: hard ? '0.04em' : 0,
              borderRadius: hard ? 0 : 999,
            }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${gid}`}
                className="absolute inset-0 -z-0"
                style={{ background: t.accent, borderRadius: hard ? 0 : 999 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
