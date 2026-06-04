import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Users, LogOut, Check, BellRing, CreditCard, AlertTriangle, Crown } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, sectionTitleStyle, bodyStyle, isHard } from '../../console/lib/skin'
import { Button } from '../../console/components/Button'
import { fadeUp, stagger } from '../../animations/variants'
import { formatMoney } from '../../lib/money'
import { isStaffAuthed, staffLogout } from '../../lib/api/auth'
import { StaffLogin } from '../../components/StaffLogin'
import { useStaffSessions, type UseStaffSessionsResult } from '../../hooks/useStaffSessions'
import type { DiningSessionView } from '../../lib/api/dining'

/**
 * The staff floor cockpit (no hardware — the waiter's own phone): log in, see
 * the live tables, and run the real session actions — promote a leader, fire
 * pending orders, settle/dispute/close — all against the Django backend.
 */
export function StaffCockpit() {
  const { tokens: t } = useTheme()
  const [authed, setAuthed] = useState(isStaffAuthed())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const staff = useStaffSessions(authed)

  if (!authed) {
    return (
      <StaffLogin
        onSuccess={() => setAuthed(true)}
        title="Floor sign-in"
        subtitle="Sign in to manage live tables."
      />
    )
  }

  const selected = staff.sessions.find(s => s.id === selectedId) ?? null
  if (selected) {
    return (
      <SessionDetail
        session={selected}
        staff={staff}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full px-4 sm:px-6" style={{ background: t.bg }}>
      <div className="pt-5 pb-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[12px] uppercase tracking-[0.18em]" style={{ ...bodyStyle(t), color: t.descColor }}>
            Live floor
          </p>
          <h2 className="font-bold text-[22px]" style={{ ...sectionTitleStyle(t), color: t.accent }}>
            {staff.sessions.length} table{staff.sessions.length === 1 ? '' : 's'} seated
          </h2>
        </div>
        <button
          onClick={() => { staffLogout(); setAuthed(false) }}
          className="flex items-center gap-1.5 text-[12px] px-3 py-2"
          style={{ ...bodyStyle(t), color: t.descColor, border: `1px solid ${t.ruleColor}`, borderRadius: isHard(t) ? 0 : 999 }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>

      {staff.sessions.length === 0 ? (
        <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>
          No live tables yet. When a guest scans a table QR, it appears here.
        </p>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex-1 overflow-y-auto pb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {staff.sessions.map(s => {
            const pending = s.orders.filter(o => o.confirmation === 'pending_confirmation').length
            return (
              <motion.button
                key={s.id}
                variants={fadeUp}
                onClick={() => setSelectedId(s.id)}
                className="text-left p-4 transition-transform active:scale-[0.97]"
                style={panelStyle(t)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[20px]" style={{ ...sectionTitleStyle(t), color: t.accent }}>
                    {s.table_label || s.table_code}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-[12px] mt-2 flex items-center gap-1" style={{ ...bodyStyle(t), color: t.descColor }}>
                  <Users size={13} /> {s.party_size}
                  <span className="mx-1">·</span>
                  <span style={{ fontFamily: t.priceFont, color: t.priceColor }}>
                    {formatMoney(Math.round((s.check?.total_minor ?? 0) / 100))}
                  </span>
                </p>
                {pending > 0 && (
                  <p className="text-[11px] mt-1 font-semibold" style={{ color: '#b45309' }}>
                    {pending} order{pending === 1 ? '' : 's'} to fire
                  </p>
                )}
              </motion.button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function SessionDetail({
  session,
  staff,
  onBack,
}: {
  session: DiningSessionView
  staff: UseStaffSessionsResult
  onBack: () => void
}) {
  const { tokens: t } = useTheme()
  const [busy, setBusy] = useState(false)
  const radius = isHard(t) ? 0 : 999
  const pendingOrders = session.orders.filter(o => o.confirmation === 'pending_confirmation')
  const total = session.check?.total_minor ?? 0
  const settled = session.check?.status === 'settled'

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col h-full px-4 sm:px-6 overflow-y-auto" style={{ background: t.bg }}>
      <div className="flex items-center gap-3 py-3 sticky top-0 z-10" style={{ background: t.bg, borderBottom: `1.5px solid ${t.ruleColor}` }}>
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{ background: `${t.accent}1A`, color: t.accent, borderRadius: radius }}
          aria-label="Back to floor"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[18px] leading-none" style={{ ...sectionTitleStyle(t), color: t.accent }}>
            Table {session.table_label || session.table_code}
          </h2>
          <p className="text-[11px] mt-1" style={{ ...bodyStyle(t), color: t.descColor }}>
            {session.order_confirmation_mode.replace('_', ' ')} · {session.party_size} guests
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Pending orders to fire (waiter_confirm) */}
      {pendingOrders.length > 0 && (
        <div className="mt-3 p-3" style={{ ...panelStyle(t), borderColor: '#f59e0b' }}>
          <p className="text-[13px] font-semibold mb-2" style={sectionTitleStyle(t)}>
            {pendingOrders.length} order{pendingOrders.length === 1 ? '' : 's'} waiting to fire
          </p>
          {pendingOrders.flatMap(o => o.lines).map(l => (
            <p key={l.id} className="text-[12px]" style={bodyStyle(t)}>{l.qty}× {l.item_name}</p>
          ))}
          <div className="mt-2">
            <Button
              variant="primary" size="sm" disabled={busy}
              onClick={() => act(() => staff.confirm(session.id, pendingOrders.map(o => o.id)))}
              aria-label="Fire pending orders"
            >
              <Check size={15} /> Fire to kitchen
            </Button>
          </div>
        </div>
      )}

      {/* Devices / leader */}
      <p className="text-[11px] uppercase tracking-[0.16em] mt-4 mb-2" style={{ ...bodyStyle(t), color: t.descColor }}>
        Devices at the table
      </p>
      <div className="flex flex-col gap-2">
        {session.devices.map(d => {
          const isLeader = d.role === 'leader'
          return (
            <div key={d.id} className="flex items-center gap-2 p-2.5" style={panelStyle(t)}>
              <span className="flex-1 text-[13px] truncate" style={{ ...bodyStyle(t), color: t.ink }}>
                {d.display_name || 'Guest'}{isLeader && <Crown size={13} className="inline ml-1" style={{ color: '#D9A03A' }} />}
              </span>
              {session.order_confirmation_mode === 'leader' && !isLeader && (
                <Button
                  variant="ghost" size="sm" disabled={busy}
                  onClick={() => act(() => staff.promote(session.id, d.id))}
                  aria-label={`Make ${d.display_name || 'guest'} the leader`}
                >
                  Make leader
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bill + governance */}
      <div className="mt-4 p-3" style={panelStyle(t)}>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold" style={sectionTitleStyle(t)}>Bill</span>
          <span className="text-[18px] font-bold" style={{ fontFamily: t.priceFont, color: t.priceColor }}>
            {formatMoney(Math.round(total / 100))}{settled ? ' · settled' : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => staff.settleCash(session.id))} aria-label="Settle cash">
            <CreditCard size={14} /> Settle cash
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => staff.dispute(session.id, 'walkout'))} aria-label="Dispute">
            <AlertTriangle size={14} /> Dispute
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => act(async () => { await staff.close(session.id); onBack() })} aria-label="Close table">
            <BellRing size={14} /> Close table
          </Button>
        </div>
      </div>
      <div className="h-6" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { tokens: t } = useTheme()
  return (
    <span
      className="text-[10px] px-2 py-0.5 uppercase tracking-wide"
      style={{ background: `${t.accent}1A`, color: t.accent, borderRadius: isHard(t) ? 0 : 999, fontFamily: t.descFont }}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

