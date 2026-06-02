import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'
import { cn } from '../lib/format'
import type { StatusStyle } from '../lib/statusColors'

interface BadgeProps {
  status: StatusStyle
  /** Show a leading status dot. */
  dot?: boolean
  label?: string
  className?: string
}

/** Semantic status pill driven by a StatusStyle from statusColors.ts. */
export function Badge({ status, dot = true, label, className = '' }: BadgeProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        className,
      )}
      style={{
        color: status.fg,
        background: status.tint,
        border: `1px solid ${status.ring}`,
        borderRadius: hard ? 0 : 999,
        fontFamily: t.descFont,
        textTransform: hard ? 'uppercase' : 'none',
        letterSpacing: hard ? '0.04em' : 0,
      }}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: status.fg }}
        />
      )}
      {hard ? `[ ${label ?? status.label} ]` : label ?? status.label}
    </span>
  )
}
