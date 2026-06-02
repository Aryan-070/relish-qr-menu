import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageCircle,
  Smartphone,
  Mail,
  Send,
  Users,
  Sparkles,
  Gift,
  Cake,
  Heart,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../components/Toast'
import { isHard } from '../lib/skin'
import { inr } from '../lib/format'
import { getNotifyProvider } from '../../lib/notify'
import { fadeUp, stagger } from '../../animations/variants'
import type { StatusStyle } from '../lib/statusColors'
import type { Customer, LoyaltyTier } from '../lib/types'

/* ── Segment + channel config ─────────────────────────────────────────────── */

type SegmentId = 'all' | 'gold' | 'silver' | 'bronze' | 'lapsed' | 'vip'
type ChannelId = 'whatsapp' | 'sms' | 'email'

const DAY = 86_400_000
const LAPSED_DAYS = 30
const VIP_SPEND = 20_000

const SEGMENTS: { value: SegmentId; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'vip', label: 'VIP' },
]

const SEGMENT_HINT: Record<SegmentId, string> = {
  all: 'Everyone in your loyalty base.',
  gold: 'Top-tier loyalty members.',
  silver: 'Mid-tier loyalty members.',
  bronze: 'Entry-tier loyalty members.',
  lapsed: `No visit in over ${LAPSED_DAYS} days — ripe for a win-back.`,
  vip: `Lifetime spend of ${inr(VIP_SPEND)} or more.`,
}

/** Real segment math over the loyalty base. */
function matchesSegment(c: Customer, seg: SegmentId, now: number): boolean {
  switch (seg) {
    case 'all':
      return true
    case 'gold':
      return c.tier === 'Gold'
    case 'silver':
      return c.tier === 'Silver'
    case 'bronze':
      return c.tier === 'Bronze'
    case 'lapsed':
      return now - c.lastVisit > LAPSED_DAYS * DAY
    case 'vip':
      return c.lifetimeSpend >= VIP_SPEND
    default:
      return false
  }
}

const CHANNELS: { value: ChannelId; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

const CHANNEL_META: Record<ChannelId, { label: string; icon: LucideIcon; limit: number }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, limit: 1024 },
  sms: { label: 'SMS', icon: Smartphone, limit: 160 },
  email: { label: 'Email', icon: Mail, limit: 2000 },
}

/* ── Quick templates ──────────────────────────────────────────────────────── */

interface Template {
  id: string
  label: string
  icon: LucideIcon
  body: string
}

const TEMPLATES: Template[] = [
  {
    id: 'winback',
    label: 'Win-back',
    icon: Heart,
    body: 'Hi {name}, we miss you at Relish! Here’s 15% off your next visit — see you soon. ❤️',
  },
  {
    id: 'gold-perk',
    label: 'Gold perk',
    icon: Star,
    body: 'Hi {name}, as a Gold member you’ve unlocked a complimentary dessert on your next table. Thank you for dining with Relish.',
  },
  {
    id: 'birthday',
    label: 'Birthday offer',
    icon: Cake,
    body: 'Happy birthday, {name}! Celebrate with us — your cake’s on the house and dinner comes with 20% off. 🎂',
  },
]

/* ── Tier badge styling (local — no shared tier palette exists) ───────────── */

const TIER_STYLE: Record<LoyaltyTier, StatusStyle> = {
  Gold: { label: 'Gold', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  Silver: { label: 'Silver', fg: '#5b5b5b', tint: 'rgba(120,120,120,0.14)', ring: 'rgba(120,120,120,0.40)' },
  Bronze: { label: 'Bronze', fg: '#8a5a2b', tint: 'rgba(166,108,54,0.14)', ring: 'rgba(166,108,54,0.45)' },
}

/* ── Automations config ───────────────────────────────────────────────────── */

interface AutomationDef {
  id: string
  title: string
  description: string
  icon: LucideIcon
  defaultOn: boolean
}

const AUTOMATIONS: AutomationDef[] = [
  {
    id: 'feedback',
    title: 'Post-visit feedback request',
    description: 'Send an NPS rating prompt a few hours after each guest pays their bill.',
    icon: Sparkles,
    defaultOn: true,
  },
  {
    id: 'birthday',
    title: 'Birthday offer',
    description: 'Auto-send a celebratory discount on each member’s birthday.',
    icon: Gift,
    defaultOn: true,
  },
  {
    id: 'winback',
    title: 'Win-back after 30 days',
    description: 'Nudge members who haven’t returned in 30 days with a comeback offer.',
    icon: Heart,
    defaultOn: false,
  },
]

/* ── View ─────────────────────────────────────────────────────────────────── */

export function Campaigns() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()
  const hard = isHard(t)

  const [segment, setSegment] = useState<SegmentId>('all')
  const [channel, setChannel] = useState<ChannelId>('whatsapp')
  const [message, setMessage] = useState('')
  const [autos, setAutos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AUTOMATIONS.map(a => [a.id, a.defaultOn])),
  )
  const [sending, setSending] = useState(false)

  const now = Date.now()

  const audience = useMemo(
    () => ops.state.customers.filter(c => matchesSegment(c, segment, now)),
    [ops.state.customers, segment, now],
  )

  const channelMeta = CHANNEL_META[channel]
  const trimmed = message.trim()
  const overLimit = message.length > channelMeta.limit
  const canSend = audience.length > 0 && trimmed.length > 0 && !overLimit && !sending

  const applyTemplate = (tpl: Template) => {
    setMessage(tpl.body)
  }

  const send = async () => {
    if (!canSend) return
    setSending(true)
    const provider = getNotifyProvider()
    // Subject only carries for email; channel is used as-is (ChannelId ⊆ NotifyChannel).
    const subject = channel === 'email' ? 'A message from Relish' : undefined
    try {
      const results = await Promise.all(
        audience.map(c =>
          provider.send({
            channel,
            to: c.id,
            body: trimmed.replace(/\{name\}/g, c.name),
            subject,
          }),
        ),
      )
      const sent = results.filter(r => r.ok).length
      const failed = results.length - sent
      if (failed > 0) {
        push(
          `Sent to ${sent} of ${results.length} via ${channelMeta.label} — ${failed} failed (demo)`,
          'info',
        )
      } else {
        push(
          `Sent to ${sent} ${sent === 1 ? 'customer' : 'customers'} via ${channelMeta.label} (demo)`,
          'success',
        )
      }
    } catch {
      push('Send failed — please try again (demo)', 'warn')
    } finally {
      setSending(false)
    }
  }

  const toggleAuto = (a: AutomationDef) => {
    setAutos(prev => {
      const next = !prev[a.id]
      push(`${a.title} ${next ? 'enabled' : 'disabled'} (demo)`, next ? 'success' : 'info')
      return { ...prev, [a.id]: next }
    })
  }

  const preview = audience.slice(0, 6)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Marketing Campaigns
        </h1>
        <p className="text-[13px] mt-1.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Demo — composing only, no messages are sent.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        {/* Composer column */}
        <div className="flex flex-col gap-4">
          {/* Segment */}
          <Panel title="Audience" subtitle={SEGMENT_HINT[segment]}>
            <div className="flex flex-col gap-3.5">
              <SegmentedControl<SegmentId>
                options={SEGMENTS}
                value={segment}
                onChange={setSegment}
                ariaLabel="Customer segment"
                size="sm"
                className="flex-wrap"
              />
              <div
                className="flex items-center gap-2.5 px-3.5 py-3"
                style={{
                  background: 'rgba(42,30,30,0.04)',
                  borderRadius: hard ? 0 : 12,
                  border: `1px solid ${t.ruleColor}`,
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-9 h-9 shrink-0"
                  style={{ background: t.accent, color: '#fff', borderRadius: hard ? 0 : 999 }}
                  aria-hidden
                >
                  <Users size={16} />
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[18px] leading-none font-semibold tabular-nums"
                    style={{ fontFamily: t.titleFont, color: t.ink }}
                  >
                    {audience.length}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
                    {audience.length === 1 ? 'customer' : 'customers'} in this audience
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          {/* Channel + composer */}
          <Panel title="Compose" subtitle="India-first — WhatsApp by default.">
            <div className="flex flex-col gap-3.5">
              <SegmentedControl<ChannelId>
                options={CHANNELS}
                value={channel}
                onChange={setChannel}
                ariaLabel="Outreach channel"
                size="sm"
              />

              {/* Templates */}
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map(tpl => {
                  const Icon = tpl.icon
                  return (
                    <Button key={tpl.id} variant="subtle" size="sm" onClick={() => applyTemplate(tpl)}>
                      <Icon size={13} aria-hidden /> {tpl.label}
                    </Button>
                  )
                })}
              </div>

              {/* Textarea */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="campaign-message" className="sr-only">
                  Message
                </label>
                <textarea
                  id="campaign-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Write your message… use {name} to personalise each greeting."
                  className="w-full resize-y px-3.5 py-3 text-[13px] leading-relaxed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={{
                    background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6',
                    border: `1px solid ${overLimit ? '#b3141b' : t.ruleColor}`,
                    borderRadius: hard ? 0 : 12,
                    color: t.ink,
                    fontFamily: t.descFont,
                    outlineColor: t.accent,
                  }}
                />
                <div className="flex items-center justify-between gap-2 text-[11px]" style={{ fontFamily: t.descFont }}>
                  <span style={{ color: t.descColor }}>
                    Tip: <code style={{ color: t.inkSoft }}>{'{name}'}</code> is replaced with each customer’s name.
                  </span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: overLimit ? '#b3141b' : t.descColor }}
                  >
                    {message.length}/{channelMeta.limit}
                  </span>
                </div>
              </div>

              {/* Send */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                  No messages are actually sent — this is a demo surface.
                </p>
                <Button variant="primary" size="md" onClick={send} disabled={!canSend}>
                  <Send size={15} aria-hidden />{' '}
                  {sending ? 'Sending…' : `Send to ${audience.length} via ${channelMeta.label}`}
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Side column: preview + automations */}
        <div className="flex flex-col gap-4">
          {/* Audience preview */}
          <Panel title="Audience preview" subtitle={`First ${preview.length} of ${audience.length}`} padded={false}>
            {preview.length === 0 ? (
              <EmptyState
                icon={<Users size={28} />}
                title="No customers match"
                description="Pick a different segment to build an audience."
              />
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                {preview.map(c => (
                  <motion.div
                    key={c.id}
                    variants={fadeUp}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                    style={{ borderBottom: `1px solid ${t.ruleColor}` }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                        {c.name}
                      </p>
                      <p className="text-[11px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
                        {c.visits} {c.visits === 1 ? 'visit' : 'visits'} · {inr(c.lifetimeSpend)}
                      </p>
                    </div>
                    <Badge status={TIER_STYLE[c.tier]} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </Panel>

          {/* Automations */}
          <Panel title="Automations" subtitle="Always-on journeys — config only.">
            <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-2.5">
              {AUTOMATIONS.map(a => {
                const on = autos[a.id]
                const Icon = a.icon
                return (
                  <motion.button
                    key={a.id}
                    variants={fadeUp}
                    type="button"
                    onClick={() => toggleAuto(a)}
                    aria-pressed={on}
                    className="text-left flex items-start gap-3 p-3.5 cursor-pointer transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      background: 'rgba(42,30,30,0.04)',
                      border: `1px solid ${on ? t.accent : t.ruleColor}`,
                      borderRadius: hard ? 0 : 12,
                      outlineColor: t.accent,
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 shrink-0"
                      style={{
                        background: on ? t.accent : 'rgba(42,30,30,0.06)',
                        color: on ? '#fff' : t.inkSoft,
                        borderRadius: hard ? 0 : 999,
                      }}
                      aria-hidden
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[13px] font-semibold leading-tight"
                          style={{ fontFamily: t.titleFont, color: t.ink }}
                        >
                          {a.title}
                        </span>
                        <Badge
                          status={on ? AUTO_ON_STYLE : AUTO_OFF_STYLE}
                          dot={false}
                          label={on ? 'On' : 'Off'}
                        />
                      </div>
                      <p className="text-[11px] mt-1 leading-snug" style={{ color: t.descColor, fontFamily: t.descFont }}>
                        {a.description}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </motion.div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

const AUTO_ON_STYLE: StatusStyle = {
  label: 'On',
  fg: '#3d6130',
  tint: 'rgba(79,122,60,0.12)',
  ring: 'rgba(79,122,60,0.40)',
}
const AUTO_OFF_STYLE: StatusStyle = {
  label: 'Off',
  fg: '#5b4a44',
  tint: 'rgba(74,63,58,0.10)',
  ring: 'rgba(74,63,58,0.32)',
}
