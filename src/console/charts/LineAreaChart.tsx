import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { VisuallyHiddenTable } from './VisuallyHiddenTable'

export interface LinePoint {
  label: string
  value: number
}

interface LineAreaChartProps {
  data: LinePoint[]
  ariaLabel: string
  height?: number
  color?: string
  formatValue?: (v: number) => string
  className?: string
}

const W = 600 // viewBox width; scales responsively via width:100%

/** Revenue / orders trend over days. Smooth area + animated stroke. */
export function LineAreaChart({
  data,
  ariaLabel,
  height = 200,
  color = '#8B1024',
  formatValue = v => String(Math.round(v)),
  className = '',
}: LineAreaChartProps) {
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const gid = useId()
  const padX = 8
  const padTop = 12
  const padBottom = 22

  if (data.length < 2) {
    return <div style={{ height }} className={className} aria-label={ariaLabel} role="img" />
  }

  const max = Math.max(...data.map(d => d.value), 1)
  const plotH = height - padTop - padBottom
  const stepX = (W - padX * 2) / (data.length - 1)
  const pts = data.map((d, i) => {
    const x = padX + i * stepX
    const y = padTop + (1 - d.value / max) * plotH
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - padBottom} L${pts[0][0].toFixed(1)},${height - padBottom} Z`

  // Sparse x labels (~6).
  const labelEvery = Math.ceil(data.length / 6)
  const gridLines = [0.25, 0.5, 0.75, 1]

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridLines.map(g => {
          const y = padTop + g * plotH
          return <line key={g} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(42,30,30,0.08)" strokeWidth={1} />
        })}
        <path d={area} fill={`url(#grad-${gid})`} />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <span key={i} className="text-[10px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {d.label}
            </span>
          ) : null,
        )}
      </div>
      <VisuallyHiddenTable
        caption={ariaLabel}
        columns={['Day', 'Value']}
        rows={data.map(d => [d.label, formatValue(d.value)])}
      />
    </div>
  )
}
