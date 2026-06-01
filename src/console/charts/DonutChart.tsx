import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { VisuallyHiddenTable } from './VisuallyHiddenTable'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  ariaLabel: string
  centerLabel?: string
  centerValue?: string
  size?: number
  formatValue?: (v: number) => string
  className?: string
}

/** Category mix donut with legend + center total. */
export function DonutChart({
  slices,
  ariaLabel,
  centerLabel,
  centerValue,
  size = 168,
  formatValue = v => String(Math.round(v)),
  className = '',
}: DonutChartProps) {
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const total = slices.reduce((s, d) => s + d.value, 0) || 1
  const r = size / 2 - 12
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r

  let offset = 0
  const arcs = slices.map(s => {
    const frac = s.value / total
    const arc = { ...s, frac, dash: frac * circ, gap: circ - frac * circ, rot: (offset / total) * 360 }
    offset += s.value
    return arc
  })

  return (
    <div className={`flex items-center gap-5 ${className}`} role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {arcs.map((a, i) => (
            <motion.circle
              key={a.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={14}
              strokeDasharray={`${a.dash} ${a.gap}`}
              transform={`rotate(${a.rot} ${cx} ${cy})`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            />
          ))}
        </g>
        {(centerValue || centerLabel) && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontFamily: t.headerFont, fontWeight: 700, fill: t.ink, fontSize: 18 }}>
              {centerValue}
            </text>
            <text x={cx} y={cy + 15} textAnchor="middle" style={{ fontFamily: t.descFont, fill: t.descColor, fontSize: 10 }}>
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <ul className="flex flex-col gap-1.5 min-w-0">
        {arcs.map(a => (
          <li key={a.label} className="flex items-center gap-2 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: a.color }} aria-hidden />
            <span className="truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
              {a.label}
            </span>
            <span className="ml-auto tabular-nums" style={{ color: t.descColor, fontFamily: t.priceFont }}>
              {Math.round(a.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <VisuallyHiddenTable
        caption={ariaLabel}
        columns={['Category', 'Value', 'Share']}
        rows={arcs.map(a => [a.label, formatValue(a.value), `${Math.round(a.frac * 100)}%`])}
      />
    </div>
  )
}
