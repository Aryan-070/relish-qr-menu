import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Instagram, Send, CheckCircle2, ExternalLink } from 'lucide-react'
import { useT } from '../../i18n'
import { useOpsStore } from '../../console/store/useOpsStore'
import { resolveGuestTableId } from '../../lib/tableSession'
import { RESTAURANT } from '../../data/restaurant'

interface FeedbackViewProps {
  /** Called when the guest finishes (after submit / done). */
  onDone: () => void
}

// Post-visit feedback + review routing (the "Sunday" pattern): a happy guest
// (4–5★) is nudged toward a public Google review; an unhappy one (1–3★) is
// routed to private feedback that reaches the manager, not the public web.
// Every rating is recorded to the ops store so the restaurant sees it either way.
export function FeedbackView({ onDone }: FeedbackViewProps) {
  const tr = useT()
  const ops = useOpsStore()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  const positive = rating >= 4
  const active = hover || rating

  const recordFeedback = () => {
    ops.addFeedback({
      id: `fb-${Date.now()}`,
      rating,
      comment: comment.trim() || undefined,
      tableId: resolveGuestTableId(),
      createdAt: Date.now(),
      routedToPublic: positive,
    })
    setSent(true)
  }

  // ── Thank-you state ────────────────────────────────────────────────────────
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center gap-3 px-4 py-8"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(79,122,60,0.12)', border: '2px solid #4F7A3C' }}
        >
          <CheckCircle2 size={30} style={{ color: '#4F7A3C' }} />
        </div>
        <p className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>
          {tr('feedback.thanks')}
        </p>
        <p className="font-inter text-[12.5px] max-w-[260px]" style={{ color: 'var(--ink-soft)' }}>
          {tr('feedback.thanksSub')}
        </p>
        <SocialButton kind="instagram" label={tr('feedback.followUs')} />
        <button
          onClick={onDone}
          className="mt-1 font-inter text-[12px] underline underline-offset-2"
          style={{ color: 'var(--mute)' }}
        >
          {tr('action.done')}
        </button>
      </motion.div>
    )
  }

  // ── Rating + routing ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <div className="text-center flex flex-col gap-1">
        <p className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>
          {tr('feedback.q')}
        </p>
        <p className="font-inter text-[12px]" style={{ color: 'var(--mute)' }}>
          {rating === 0 ? tr('feedback.tapRate') : ''}
        </p>
      </div>

      {/* Stars */}
      <div className="flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <motion.button
            key={n}
            whileTap={{ scale: 0.85 }}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Star
              size={34}
              strokeWidth={1.5}
              style={{ color: n <= active ? '#D9A03A' : 'rgba(139,16,36,0.22)' }}
              fill={n <= active ? '#D9A03A' : 'none'}
            />
          </motion.button>
        ))}
      </div>

      {rating > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          {/* Sentiment-aware prompt */}
          <div className="text-center">
            <p className="font-inter font-semibold text-[13.5px]" style={{ color: positive ? 'var(--olive)' : 'var(--maroon)' }}>
              {positive ? tr('feedback.loved') : tr('feedback.improve')}
            </p>
            <p className="font-inter text-[12px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              {positive ? tr('feedback.lovedSub') : tr('feedback.improveSub')}
            </p>
          </div>

          {/* Positive → public Google review CTA */}
          {positive && <SocialButton kind="google" label={tr('feedback.google')} />}

          {/* Comment (optional for happy, prompted for unhappy) */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={tr('feedback.commentPlaceholder')}
            className="w-full font-inter text-[13px] resize-none rounded-xl px-3 py-2.5 outline-none"
            style={{ background: 'rgba(217,160,58,0.08)', border: '1px solid rgba(217,160,58,0.35)', color: 'var(--ink)' }}
          />

          <button
            onClick={recordFeedback}
            className="w-full py-3 rounded-full font-inter font-semibold text-[13.5px] flex items-center justify-center gap-2"
            style={{ background: 'var(--maroon)', color: '#FFF8EA' }}
          >
            <Send size={15} /> {tr('feedback.send')}
          </button>

          {/* Instagram follow is always available */}
          <SocialButton kind="instagram" label={tr('feedback.followUs')} subtle />
        </motion.div>
      )}
    </div>
  )
}

// External review / social link. Renders a real anchor the guest taps — we never
// auto-open or post on their behalf.
function SocialButton({
  kind,
  label,
  subtle,
}: {
  kind: 'google' | 'instagram'
  label: string
  subtle?: boolean
}) {
  const href = kind === 'google' ? RESTAURANT.googleReviewUrl : RESTAURANT.instagramUrl
  const Icon = kind === 'instagram' ? Instagram : ExternalLink
  const bg = kind === 'google' ? 'var(--gold)' : subtle ? 'transparent' : 'var(--maroon)'
  const color = subtle ? 'var(--maroon)' : '#FFF8EA'
  const border = subtle ? '1px solid rgba(139,16,36,0.3)' : 'none'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full py-2.5 rounded-full font-inter font-semibold text-[13px] flex items-center justify-center gap-2 no-underline"
      style={{ background: bg, color, border }}
    >
      <Icon size={15} /> {label}
    </a>
  )
}
