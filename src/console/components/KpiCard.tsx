import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'
import { cn, pct } from '../lib/format'
import { fadeUp } from '../../animations/variants'
import { Sparkline } from '../charts/Sparkline'

interface KpiCardProps {
  label: string
  value: string
  delta?: number
  spark?: number[]
  /** Higher-is-better metrics flip the delta colour when false. */
  goodWhenUp?: boolean
  className?: string
}

export function KpiCard({ label, value, delta, spark, goodWhenUp = true, className = '' }: KpiCardProps) {
  const { tokens: t } = useTheme()
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
        <span className="text-[26px] leading-none tabular-nums" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}>
          {value}
        </span>
        {spark && spark.length > 1 && <Sparkline data={spark} width={84} height={28} />}
      </div>
      {hasDelta && (
        <span className="text-[12px] font-semibold" style={{ color: deltaColor, fontFamily: t.priceFont }}>
          {pct(delta!)} <span className="font-normal" style={{ color: t.descColor }}>vs prev</span>
        </span>
      )}
    </motion.div>
  )
}
