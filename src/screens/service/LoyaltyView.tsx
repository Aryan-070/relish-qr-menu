import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gift, Crown, Sparkles, Check } from 'lucide-react'
import { useT } from '../../i18n'
import { useOpsStore } from '../../console/store/useOpsStore'
import type { Customer, LoyaltyTier } from '../../console/lib/types'

interface LoyaltyViewProps {
  /** The customer currently linked to this table session, if any. */
  activeCustomerId: string | null
  /** Link a customer to the session (looked up or just joined). */
  onLink: (customerId: string) => void
}

const WELCOME_POINTS = 50

const TIER_STYLE: Record<LoyaltyTier, { bg: string; fg: string }> = {
  Gold: { bg: 'rgba(217,160,58,0.16)', fg: '#9A6A12' },
  Silver: { bg: 'rgba(120,120,120,0.14)', fg: '#5b5b5b' },
  Bronze: { bg: 'rgba(154,106,18,0.12)', fg: '#7c5a2e' },
}

/** Last-10-digits comparison so "+91 98765 43210" matches "9876543210". */
function digits(s: string): string {
  return s.replace(/\D/g, '').slice(-10)
}

// Guest-facing loyalty: look up a member by phone (or join with a welcome
// bonus), then show their points/tier. Points accrue on order placement (App
// wires the linked customer into the order flow).
export function LoyaltyView({ activeCustomerId, onLink }: LoyaltyViewProps) {
  const tr = useT()
  const ops = useOpsStore()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [justJoined, setJustJoined] = useState(false)
  const [redeemed, setRedeemed] = useState(false)

  const customer: Customer | undefined = activeCustomerId
    ? ops.state.customers.find(c => c.id === activeCustomerId)
    : undefined

  const submit = () => {
    const d = digits(phone)
    if (d.length < 10) return
    const existing = ops.state.customers.find(c => digits(c.phone) === d)
    if (existing) {
      onLink(existing.id)
      return
    }
    const now = Date.now()
    const created: Customer = {
      id: `cus-${now}`,
      name: name.trim() || 'Guest',
      phone,
      points: WELCOME_POINTS,
      tier: 'Bronze',
      visits: 1,
      lifetimeSpend: 0,
      tags: ['New'],
      lastVisit: now,
      joinedAt: now,
    }
    ops.addCustomer(created)
    setJustJoined(true)
    onLink(created.id)
  }

  // ── Member card ─────────────────────────────────────────────────────────────
  if (customer) {
    const tier = TIER_STYLE[customer.tier]
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 px-1 py-2">
        {justJoined && (
          <div className="text-center flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,122,60,0.12)', border: '2px solid #4F7A3C' }}>
              <Sparkles size={22} style={{ color: '#4F7A3C' }} />
            </div>
            <p className="font-playfair font-bold text-[16px]" style={{ color: 'var(--maroon)' }}>{tr('loyalty.welcome')}</p>
            <p className="font-inter text-[12px]" style={{ color: 'var(--ink-soft)' }}>{tr('loyalty.welcomeSub')}</p>
          </div>
        )}

        {/* Points card */}
        <div className="rounded-2xl px-5 py-5 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--maroon), #7A0E1E)', color: '#FFF8EA' }}>
          <p className="font-inter text-[11px] uppercase tracking-widest" style={{ opacity: 0.8 }}>{customer.name}</p>
          <p className="font-playfair font-bold" style={{ fontSize: 40, lineHeight: 1.1 }}>{customer.points}</p>
          <p className="font-inter text-[12px]" style={{ opacity: 0.85 }}>{tr('loyalty.points')}</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(255,248,234,0.18)' }}>
            <Crown size={12} /> {customer.tier}
          </span>
        </div>

        <div className="flex items-center justify-around text-center">
          <Stat label={tr('loyalty.visits')} value={String(customer.visits)} />
          <Stat label={tr('loyalty.tier')} value={customer.tier} tierStyle={tier} />
        </div>

        <p className="font-inter text-[11.5px] text-center" style={{ color: 'var(--mute)' }}>{tr('loyalty.earnHint')}</p>

        {customer.points >= 100 && !redeemed && (
          <button
            onClick={() => { ops.adjustPoints(customer.id, -100); setRedeemed(true) }}
            className="w-full py-3 rounded-full font-inter font-semibold text-[13.5px] flex items-center justify-center gap-2"
            style={{ background: 'var(--gold)', color: '#FFF8EA' }}
          >
            <Gift size={15} /> {tr('loyalty.redeem')}
          </button>
        )}
        {redeemed && (
          <p className="font-inter text-[12.5px] text-center flex items-center justify-center gap-1.5" style={{ color: 'var(--olive)' }}>
            <Check size={14} /> {tr('loyalty.redeemed')}
          </p>
        )}
      </motion.div>
    )
  }

  // ── Join / lookup ───────────────────────────────────────────────────────────
  const canSubmit = digits(phone).length >= 10
  return (
    <div className="flex flex-col gap-4 px-1 py-2">
      <div className="text-center flex flex-col items-center gap-1">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,160,58,0.15)' }}>
          <Gift size={22} style={{ color: 'var(--gold)' }} />
        </div>
        <p className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>{tr('loyalty.title')}</p>
        <p className="font-inter text-[12px]" style={{ color: 'var(--ink-soft)' }}>{tr('loyalty.subtitle')}</p>
      </div>

      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        inputMode="tel"
        placeholder={tr('loyalty.phonePlaceholder')}
        className="w-full font-inter text-[14px] rounded-xl px-3.5 py-3 outline-none"
        style={{ background: 'rgba(217,160,58,0.08)', border: '1px solid rgba(217,160,58,0.35)', color: 'var(--ink)' }}
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={tr('loyalty.namePlaceholder')}
        className="w-full font-inter text-[14px] rounded-xl px-3.5 py-3 outline-none"
        style={{ background: 'rgba(217,160,58,0.08)', border: '1px solid rgba(217,160,58,0.35)', color: 'var(--ink)' }}
      />
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-full font-inter font-semibold text-[13.5px]"
        style={{ background: canSubmit ? 'var(--maroon)' : 'rgba(139,16,36,0.25)', color: '#FFF8EA' }}
      >
        {tr('loyalty.continue')}
      </button>
      <p className="font-inter text-[11.5px] text-center" style={{ color: 'var(--mute)' }}>{tr('loyalty.earnHint')}</p>
    </div>
  )
}

function Stat({ label, value, tierStyle }: { label: string; value: string; tierStyle?: { bg: string; fg: string } }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-playfair font-bold text-[18px]"
        style={tierStyle ? { color: tierStyle.fg } : { color: 'var(--ink)' }}
      >
        {value}
      </span>
      <span className="font-inter text-[10px] uppercase tracking-wider" style={{ color: 'var(--mute)' }}>{label}</span>
    </div>
  )
}
