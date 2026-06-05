import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Search, Crown, Gift, Plus, Minus } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { isStaffAuthed, staffLogout } from '../../lib/api/auth'
import { StaffLogin } from '../../components/StaffLogin'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { TextField } from '../components/Field'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../components/Toast'
import { isHard, bodyStyle } from '../lib/skin'
import { inr, ago } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { LoyaltyTier } from '../lib/types'
import {
  earnPoints,
  enrollCustomer,
  isInsufficientBalance,
  listCustomers,
  redeemPoints,
  type AdminCustomer,
} from '../lib/customersApi'

type TierFilter = 'All' | LoyaltyTier

const TIER_FILTERS: { value: TierFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Gold', label: 'Gold' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Bronze', label: 'Bronze' },
]

// Tasteful per-tier tints — gold (#D9A03A), neutral silver, warm brown bronze.
const TIER_STYLE: Record<LoyaltyTier, { fg: string; tint: string; ring: string }> = {
  Gold: { fg: '#7a5a12', tint: 'rgba(217,160,58,0.18)', ring: 'rgba(217,160,58,0.55)' },
  Silver: { fg: '#5a5a5a', tint: 'rgba(120,120,120,0.14)', ring: 'rgba(120,120,120,0.40)' },
  Bronze: { fg: '#9A6A12', tint: 'rgba(154,106,18,0.14)', ring: 'rgba(154,106,18,0.40)' },
}

const CUSTOMERS_KEY = ['admin-customers']

/** Deterministic hue (0–360) derived from a customer id/name for the avatar tint. */
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

/**
 * The live Loyalty & CRM directory — the console's members view on the Django
 * API (`/api/crm/customers/`) via React Query. Self-contained: gates on the
 * Django staff login and does not touch the localStorage useOpsStore. Points
 * actions map onto the server-side loyalty ledger (earn/redeem); enroll adds a
 * member by phone.
 */
export function LoyaltyCrmLive() {
  const [authed, setAuthed] = useState(isStaffAuthed())
  if (!authed) {
    return (
      <StaffLogin
        onSuccess={() => setAuthed(true)}
        title="Console sign-in"
        subtitle="Sign in to manage members and loyalty."
      />
    )
  }
  return <LoyaltyEditor onSignOut={() => { staffLogout(); setAuthed(false) }} />
}

function LoyaltyEditor({ onSignOut }: { onSignOut: () => void }) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const queryClient = useQueryClient()
  const { push } = useToast()
  const radius = hard ? 0 : 999

  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('All')
  const [enrolling, setEnrolling] = useState(false)

  const customersQuery = useQuery({ queryKey: CUSTOMERS_KEY, queryFn: listCustomers })
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data])
  const invalidate = () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY })

  const earn = useMutation({
    mutationFn: (v: { c: AdminCustomer; points: number }) => earnPoints(v.c.id, v.points),
    onSuccess: (_d, v) => { invalidate(); push(`+${v.points} pts · ${v.c.name}`, 'success') },
    onError: () => push('Couldn’t add points — try again', 'info'),
  })

  const redeem = useMutation({
    mutationFn: (v: { c: AdminCustomer; points: number }) => redeemPoints(v.c.id, v.points),
    onSuccess: (_d, v) => { invalidate(); push(`Redeemed ${v.points} pts · ${v.c.name}`, 'success') },
    onError: err => push(isInsufficientBalance(err) ? 'Not enough points' : 'Couldn’t redeem — try again', 'info'),
  })

  const enroll = useMutation({
    mutationFn: (v: { phone: string; name: string }) => enrollCustomer(v.phone, v.name),
    onSuccess: d => { invalidate(); push(`${d.name || d.phone} enrolled`, 'success'); setEnrolling(false) },
    onError: () => push('Couldn’t enroll — check the phone number', 'info'),
  })

  const kpis = useMemo(() => {
    const total = customers.length
    const byTier = { Gold: 0, Silver: 0, Bronze: 0 } as Record<LoyaltyTier, number>
    let totalPoints = 0
    for (const c of customers) {
      byTier[c.tier] += 1
      totalPoints += c.points
    }
    return { total, byTier, avgPoints: total ? Math.round(totalPoints / total) : 0 }
  }, [customers])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = customers.filter(c => {
      if (tierFilter !== 'All' && c.tier !== tierFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))
      )
    })
    return [...filtered].sort((a, b) => b.points - a.points)
  }, [customers, query, tierFilter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
            Loyalty &amp; CRM
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Your members, points and tiers · Django
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" size="sm" onClick={() => setEnrolling(true)} aria-label="Enroll member">
            <Plus size={15} aria-hidden /> Enroll member
          </Button>
          <button
            onClick={onSignOut}
            className="text-[12px] px-3 py-1.5"
            style={{ ...bodyStyle(t), color: t.descColor, border: `1px solid ${t.ruleColor}`, borderRadius: radius }}
          >
            Sign out
          </button>
        </div>
      </div>

      {customersQuery.isLoading ? (
        <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>Loading members…</p>
      ) : customersQuery.isError ? (
        <p className="text-[13px] py-10 text-center" style={{ color: '#c0392b' }}>
          Couldn’t load members. Your session may have expired — sign out and back in.
        </p>
      ) : (
        <>
          {/* KPI strip */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            <KpiTile label="Members" value={String(kpis.total)} />
            <KpiTile label="Gold" value={String(kpis.byTier.Gold)} />
            <KpiTile label="Silver" value={String(kpis.byTier.Silver)} />
            <KpiTile label="Bronze" value={String(kpis.byTier.Bronze)} />
            <KpiTile label="Avg points" value={kpis.avgPoints.toLocaleString('en-IN')} />
            <KpiTile label="Shown" value={String(visible.length)} />
          </motion.div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="relative flex items-center" style={{ minWidth: 220 }}>
              <Search size={15} aria-hidden className="absolute left-3 pointer-events-none" style={{ color: t.descColor }} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name or phone…"
                aria-label="Search customers by name or phone"
                className="w-full pl-9 pr-3 py-2 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6',
                  border: `1px solid ${t.ruleColor}`,
                  borderRadius: hard ? 0 : 999,
                  color: t.ink,
                  fontFamily: t.descFont,
                  outlineColor: t.accent,
                }}
              />
            </label>

            <SegmentedControl<TierFilter>
              options={TIER_FILTERS}
              value={tierFilter}
              onChange={setTierFilter}
              ariaLabel="Filter customers by tier"
              size="sm"
            />
          </div>

          {/* Directory */}
          <Panel padded={false}>
            {visible.length === 0 ? (
              <EmptyState
                icon={<Users size={30} />}
                title="No members found"
                description={
                  query.trim() || tierFilter !== 'All'
                    ? 'Try a different search or tier filter.'
                    : 'Loyalty members will appear here as guests join.'
                }
              />
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                {visible.map(c => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    onAdjust={delta => (delta > 0 ? earn.mutate({ c, points: delta }) : redeem.mutate({ c, points: -delta }))}
                    onRedeem={() => redeem.mutate({ c, points: 100 })}
                  />
                ))}
              </motion.div>
            )}
          </Panel>
        </>
      )}

      {enrolling && (
        <EnrollModal
          pending={enroll.isPending}
          onClose={() => setEnrolling(false)}
          onEnroll={(phone, name) => enroll.mutate({ phone, name })}
        />
      )}
    </div>
  )
}

interface TierBadgeProps {
  tier: LoyaltyTier
  hard: boolean
  descFont: string
}

function TierBadge({ tier, hard, descFont }: TierBadgeProps) {
  const s = TIER_STYLE[tier]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        color: s.fg,
        background: s.tint,
        border: `1px solid ${s.ring}`,
        borderRadius: hard ? 0 : 999,
        fontFamily: descFont,
        textTransform: hard ? 'uppercase' : 'none',
        letterSpacing: hard ? '0.04em' : 0,
      }}
    >
      {tier === 'Gold' && <Crown size={11} aria-hidden />}
      {hard ? `[ ${tier} ]` : tier}
    </span>
  )
}

interface CustomerRowProps {
  customer: AdminCustomer
  onAdjust: (delta: number) => void
  onRedeem: () => void
}

function CustomerRow({ customer, onAdjust, onRedeem }: CustomerRowProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const canRedeem = customer.points >= 100

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-start gap-3 px-3.5 py-3" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
        <Avatar name={customer.name} hue={hueFor(customer.id || customer.name)} size={38} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
              {customer.name || 'Guest'}
            </span>
            <TierBadge tier={customer.tier} hard={hard} descFont={t.descFont} />
          </div>

          <div className="flex items-center gap-2 mt-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
            <span className="tabular-nums">{customer.phone}</span>
            {customer.birthday && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums" title="Birthday (DD/MM)">🎂 {customer.birthday}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="tabular-nums">{customer.visits} visits</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{inr(customer.lifetimeSpend)} lifetime</span>
            <span aria-hidden>·</span>
            <span>{customer.lastVisit ? ago(customer.lastVisit) : 'New member'}</span>
          </div>

          {customer.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {customer.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    color: t.inkSoft,
                    background: 'rgba(42,30,30,0.05)',
                    border: `1px solid ${t.ruleColor}`,
                    borderRadius: hard ? 0 : 6,
                    fontFamily: t.descFont,
                    textTransform: hard ? 'uppercase' : 'none',
                    letterSpacing: hard ? '0.04em' : 0,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="text-right leading-none">
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: t.ink, fontFamily: t.headerFont }}>
              {customer.points.toLocaleString('en-IN')}
            </span>
            <span
              className="block text-[10px] uppercase mt-0.5"
              style={{ color: t.descColor, fontFamily: t.descFont, letterSpacing: '0.06em' }}
            >
              points
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="subtle" size="sm" onClick={() => onAdjust(-50)} aria-label={`Remove 50 points from ${customer.name}`} title="−50 points">
              <Minus size={13} aria-hidden /> 50
            </Button>
            <Button variant="subtle" size="sm" onClick={() => onAdjust(50)} aria-label={`Add 50 points to ${customer.name}`} title="+50 points">
              <Plus size={13} aria-hidden /> 50
            </Button>
            {canRedeem && (
              <Button variant="gold" size="sm" onClick={onRedeem} aria-label={`Redeem 100 points for ${customer.name}`} title="Redeem 100 points">
                <Gift size={13} aria-hidden /> Redeem 100
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface KpiTileProps {
  label: string
  value: string
}

function KpiTile({ label, value }: KpiTileProps) {
  const { tokens: t } = useTheme()
  return (
    <motion.div variants={fadeUp}>
      <Panel className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase" style={{ color: t.descColor, fontFamily: t.descFont, letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span className="text-[24px] leading-none tabular-nums" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}>
          {value}
        </span>
      </Panel>
    </motion.div>
  )
}

interface EnrollModalProps {
  pending: boolean
  onClose: () => void
  onEnroll: (phone: string, name: string) => void
}

function EnrollModal({ pending, onClose, onEnroll }: EnrollModalProps) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const valid = phone.trim().length >= 6

  return (
    <Modal
      open
      onClose={onClose}
      title="Enroll member"
      width={380}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={pending || !valid} onClick={() => onEnroll(phone.trim(), name.trim())}>
            {pending ? 'Enrolling…' : 'Enroll'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Phone" value={phone} onChange={setPhone} placeholder="98765 43210" type="tel" />
        <TextField label="Name (optional)" value={name} onChange={setName} placeholder="Aarav Shah" />
      </div>
    </Modal>
  )
}
