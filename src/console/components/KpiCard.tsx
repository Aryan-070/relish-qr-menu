import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'
import { cn, pct } from '../lib/format'
import { fadeUp } from '../../animations/variants'
import { Sparkline } from '../charts/Sparkline'
import { AnimatedNumber } from '@/components/ui/animated-number'

interface KpiCardProps {
  label: string
  /** A number animates (roll-up via AnimatedNumber); a string renders static. */
  value: string | number
  /** Formatter for numeric values (e.g. `inr`); defaults to locale grouping. */
  format?: (n: number) => string
  /** Decimal places to preserve while rolling (default 0). */
  precision?: number
  delta?: number
  spark?: number[]
  /** Higher-is-better metrics flip the delta colour when false. */
  goodWhenUp?: boolean
  className?: string
}

export function KpiCard({ label, value, format, precision = 0, delta, spark, goodWhenUp = true, className = '' }: KpiCardProps) {
  const { tokens: t } = useTheme()
  const reduce = useReducedMotion()
  const fmt = format ?? ((n: number) => n.toLocaleString())
  const valueNode =
    typeof value === 'number'
      ? reduce
        ? fmt(value)
        : <AnimatedNumber value={value} format={fmt} precision={precision} />
      : value
  const hasDelta = typeof delta === 'number'
  const positive = (delta ?? 0) >= 0
  const good = positive === goodWhenUp
  const deltaColor = good ? '#3d6130' : '#b3141b'

  return (
    <motion.div variants={fadeUp} style={panelStyle(t)} className={cn('p-4 flex flex-col gap-2', className)}>
      <span className="text-[11px] uppercase tracking-wider" style={{ color: t.descColor, fontFamily: t.descFont, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div className="flex items-end justify-between gap-2">
        {/* Data-density: metric value in mono with tabular figures so digits align
            across cards — the dashboard reads as an instrument, not editorial copy. */}
        <span
          className="text-[26px] leading-none tabular-nums"
          style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", color: t.ink, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {valueNode}
        </span>
        {spark && spark.length > 1 && <Sparkline data={spark} width={84} height={28} />}
      </div>
      {hasDelta && (
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: deltaColor, fontFamily: "'Geist Mono','JetBrains Mono',monospace" }}>
          {pct(delta!)} <span className="font-normal" style={{ color: t.descColor, fontFamily: t.descFont }}>vs prev</span>
        </span>
      )}
    </motion.div>
  )
}
