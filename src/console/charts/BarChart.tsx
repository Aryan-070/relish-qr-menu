import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'
import { VisuallyHiddenTable } from './VisuallyHiddenTable'

export interface BarDatum {
  label: string
  value: number
  /** Secondary caption (e.g. revenue under a qty bar). */
  sub?: string
}

interface BarChartProps {
  data: BarDatum[]
  ariaLabel: string
  valueSuffix?: string
  /** Format the primary value (e.g. money). Overrides value + valueSuffix. */
  formatValue?: (v: number) => string
  color?: string
  className?: string
}

/** Horizontal bar leaderboard (most-ordered items, item performance). */
export function BarChart({ data, ariaLabel, valueSuffix = '', formatValue, color = '#8B1024', className = '' }: BarChartProps) {
  const fmt = (v: number) => (formatValue ? formatValue(v) : `${v}${valueSuffix}`)
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const hard = isHard(t)
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <ul className="flex flex-col gap-2.5">
        {data.map((d, i) => (
          <li key={d.label + i} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
                {d.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold" style={{ fontFamily: t.priceFont, color: t.ink }}>
                {fmt(d.value)}
                {d.sub && <span className="ml-1.5 font-normal" style={{ color: t.descColor }}>{d.sub}</span>}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden"
              style={{ background: 'rgba(42,30,30,0.07)', borderRadius: hard ? 0 : 999 }}
            >
              <motion.div
                className="h-full"
                style={{
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  borderRadius: hard ? 0 : 999,
                }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(d.value / max) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
              />
            </div>
          </li>
        ))}
      </ul>
      <VisuallyHiddenTable
        caption={ariaLabel}
        columns={['Item', 'Value']}
        rows={data.map(d => [d.label, fmt(d.value)])}
      />
    </div>
  )
}
