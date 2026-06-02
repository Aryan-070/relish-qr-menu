import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquareHeart, Star } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { ago } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { StatusStyle } from '../lib/statusColors'
import type { Feedback, Table } from '../lib/types'

// Gold used for the star glyphs.
const GOLD = '#D9A03A'

type Filter = 'all' | 'positive' | 'needs-work'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'positive', label: 'Positive' },
  { value: 'needs-work', label: 'Needs work' },
]

// Sentiment buckets drive the left accent colour on each row.
type Sentiment = 'good' | 'mixed' | 'poor'
function sentimentOf(rating: number): Sentiment {
  if (rating >= 4) return 'good'
  if (rating === 3) return 'mixed'
  return 'poor'
}
const ACCENT: Record<Sentiment, string> = {
  good: '#3F7A3C', // olive/green
  mixed: '#9A6A12', // amber
  poor: '#B0202F', // red
}

// Badge styles mirror statusColors.ts so the pills read like the rest of the console.
const PUBLIC_BADGE: StatusStyle = {
  label: 'Public review',
  fg: '#3d6130',
  tint: 'rgba(79,122,60,0.12)',
  ring: 'rgba(79,122,60,0.40)',
}
const PRIVATE_BADGE: StatusStyle = {
  label: 'Private — needs follow-up',
  fg: '#8a6212',
  tint: 'rgba(217,160,58,0.16)',
  ring: 'rgba(217,160,58,0.55)',
}

/** Five-glyph star row: filled gold up to `rating`, soft outline beyond. */
function StarRating({ rating, size = 15 }: { rating: number; size?: number }) {
  const { tokens: t } = useTheme()
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map(i => {
        const on = i <= rating
        return (
          <Star
            key={i}
            size={size}
            aria-hidden
            fill={on ? GOLD : 'none'}
            color={on ? GOLD : t.ruleColor}
            strokeWidth={on ? 1.5 : 1.75}
          />
        )
      })}
    </span>
  )
}

interface FeedbackRowProps {
  fb: Feedback
  tableLabel: string
}

function FeedbackRow({ fb, tableLabel }: FeedbackRowProps) {
  const { tokens: t } = useTheme()
  const accent = ACCENT[sentimentOf(fb.rating)]
  const hasComment = Boolean(fb.comment && fb.comment.trim())

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex items-start gap-3 px-3.5 py-3"
        style={{ borderBottom: `1px solid ${t.ruleColor}`, borderLeft: `3px solid ${accent}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StarRating rating={fb.rating} />
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: t.ink, fontFamily: t.descFont }}>
              {fb.rating.toFixed(1)}
            </span>
            <Badge status={fb.routedToPublic ? PUBLIC_BADGE : PRIVATE_BADGE} />
          </div>

          <p
            className="text-[13px] mt-1.5"
            style={{
              color: hasComment ? t.ink : t.descColor,
              fontStyle: hasComment ? 'normal' : 'italic',
              fontFamily: t.descFont,
            }}
          >
            {hasComment ? `“${fb.comment!.trim()}”` : 'No comment'}
          </p>

          <div
            className="flex items-center gap-2 mt-1.5 text-[11px]"
            style={{ color: t.descColor, fontFamily: t.descFont }}
          >
            <span>{tableLabel}</span>
            <span aria-hidden>·</span>
            <span>{ago(fb.createdAt)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface KpiTileProps {
  label: string
  value: string
  hint?: string
  valueColor?: string
}

function KpiTile({ label, value, hint, valueColor }: KpiTileProps) {
  const { tokens: t } = useTheme()
  return (
    <motion.div variants={fadeUp}>
      <Panel padded className="h-full">
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: t.descColor, fontFamily: t.descFont }}
        >
          {label}
        </p>
        <p
          className="text-[28px] leading-none mt-1.5 tabular-nums"
          style={{ color: valueColor ?? t.ink, fontFamily: t.headerFont }}
        >
          {value}
        </p>
        {hint && (
          <p className="text-[11px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            {hint}
          </p>
        )}
      </Panel>
    </motion.div>
  )
}

export function FeedbackInbox() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const [filter, setFilter] = useState<Filter>('all')

  const tableLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const tb of ops.state.tables as Table[]) m.set(tb.id, tb.label)
    return m
  }, [ops.state.tables])

  // Newest first.
  const sorted = useMemo(
    () => [...ops.state.feedback].sort((a, b) => b.createdAt - a.createdAt),
    [ops.state.feedback],
  )

  const summary = useMemo(() => {
    const total = sorted.length
    if (total === 0) return { total, avg: 0, positivePct: 0, needsAttention: 0 }
    const sum = sorted.reduce((acc, f) => acc + f.rating, 0)
    const positive = sorted.filter(f => f.rating >= 4).length
    const needsAttention = sorted.filter(f => f.rating <= 3).length
    return {
      total,
      avg: sum / total,
      positivePct: Math.round((positive / total) * 100),
      needsAttention,
    }
  }, [sorted])

  const visible = useMemo(() => {
    if (filter === 'positive') return sorted.filter(f => f.rating >= 4)
    if (filter === 'needs-work') return sorted.filter(f => f.rating <= 3)
    return sorted
  }, [sorted, filter])

  const tableLabel = (fb: Feedback): string =>
    (fb.tableId && (tableLabelById.get(fb.tableId) ?? fb.tableId)) || '—'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
            Guest Feedback
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            {summary.total === 0
              ? 'No reviews collected yet'
              : `${summary.total} ${summary.total === 1 ? 'review' : 'reviews'} · ${summary.avg.toFixed(1)}★ average · ${summary.positivePct}% positive`}
          </p>
        </div>
        <SegmentedControl<Filter>
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter guest feedback"
          size="sm"
        />
      </div>

      {/* KPI strip */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <KpiTile
          label="Average rating"
          value={summary.total === 0 ? '—' : `${summary.avg.toFixed(1)}★`}
          hint={summary.total === 0 ? undefined : `across ${summary.total} ${summary.total === 1 ? 'review' : 'reviews'}`}
          valueColor={summary.total === 0 ? t.ink : GOLD}
        />
        <KpiTile label="Reviews" value={String(summary.total)} hint="post-visit ratings" />
        <KpiTile
          label="Needs attention"
          value={String(summary.needsAttention)}
          hint="rated 3★ or below"
          valueColor={summary.needsAttention > 0 ? ACCENT.poor : t.ink}
        />
      </motion.div>

      {/* List */}
      <Panel padded={false}>
        {visible.length === 0 ? (
          <EmptyState
            icon={<MessageSquareHeart size={30} />}
            title={summary.total === 0 ? 'No feedback yet' : 'Nothing here'}
            description={
              summary.total === 0
                ? 'Post-visit guest ratings and comments will appear here as they come in.'
                : filter === 'positive'
                  ? 'No positive reviews in this range yet.'
                  : 'No low ratings to follow up on — nicely done.'
            }
          />
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {visible.map(fb => (
              <FeedbackRow key={fb.id} fb={fb} tableLabel={tableLabel(fb)} />
            ))}
          </motion.div>
        )}
      </Panel>
    </div>
  )
}
