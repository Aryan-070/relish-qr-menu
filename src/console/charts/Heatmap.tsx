import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { HEATMAP_DAYS, HEATMAP_HOURS } from '../lib/analytics'
import { VisuallyHiddenTable } from './VisuallyHiddenTable'
import type { HeatCell } from '../lib/types'

interface HeatmapProps {
  cells: HeatCell[]
  ariaLabel: string
  className?: string
}

function hourLabel(h: number): string {
  if (h === 12) return '12p'
  if (h === 0) return '12a'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

/** Peak-time grid: weekday rows × service-hour columns, intensity = order count. */
export function Heatmap({ cells, ariaLabel, className = '' }: HeatmapProps) {
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const max = Math.max(...cells.map(c => c.count), 1)
  const grid = new Map(cells.map(c => [`${c.day}-${c.hour}`, c.count]))

  const intensity = (count: number): string => {
    if (count === 0) return 'rgba(42,30,30,0.04)'
    const a = 0.12 + (count / max) * 0.78
    return `rgba(139,16,36,${a.toFixed(3)})`
  }

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `28px repeat(${HEATMAP_HOURS.length}, minmax(16px, 1fr))` }}>
          {/* header row */}
          <span />
          {HEATMAP_HOURS.map(h => (
            <span key={h} className="text-[8.5px] text-center" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {hourLabel(h)}
            </span>
          ))}
          {/* day rows */}
          {HEATMAP_DAYS.map((day, di) => (
            <Row key={day} day={day} di={di} grid={grid} hours={HEATMAP_HOURS} intensity={intensity} reduce={!!reduce} descColor={t.descColor} descFont={t.descFont} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
        <span>Quiet</span>
        <div className="flex gap-[2px]">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(a => (
            <span key={a} className="w-3.5 h-3.5 rounded-[2px]" style={{ background: `rgba(139,16,36,${a})` }} />
          ))}
        </div>
        <span>Peak</span>
      </div>
      <VisuallyHiddenTable
        caption={ariaLabel}
        columns={['Day', ...HEATMAP_HOURS.map(hourLabel)]}
        rows={HEATMAP_DAYS.map((day, di) => [day, ...HEATMAP_HOURS.map(h => grid.get(`${di}-${h}`) ?? 0)])}
      />
    </div>
  )
}

interface RowProps {
  day: string
  di: number
  grid: Map<string, number>
  hours: number[]
  intensity: (c: number) => string
  reduce: boolean
  descColor: string
  descFont: string
}

function Row({ day, di, grid, hours, intensity, reduce, descColor, descFont }: RowProps) {
  return (
    <>
      <span className="text-[10px] flex items-center" style={{ color: descColor, fontFamily: descFont }}>
        {day}
      </span>
      {hours.map((h, hi) => {
        const count = grid.get(`${di}-${h}`) ?? 0
        return (
          <motion.span
            key={h}
            className="aspect-square rounded-[3px] min-w-0"
            style={{ background: intensity(count) }}
            title={`${day} ${hourLabel(h)} — ${count} orders`}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: (di * hours.length + hi) * 0.004 }}
          />
        )
      })}
    </>
  )
}
