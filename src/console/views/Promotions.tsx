import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Tags, Percent, IndianRupee, Ticket, Clock, Trash2, Plus } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { TextField, NumberField, SelectField, ToggleField } from '../components/Field'
import { useToast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { isHard } from '../lib/skin'
import { inr } from '../lib/format'
import { isPromoActive } from '../../lib/promos'
import { fadeUp, stagger } from '../../animations/variants'
import type { Promo, PromoKind } from '../lib/types'

const KIND_OPTIONS: Array<{ value: PromoKind; label: string }> = [
  { value: 'percent', label: 'Percent off' },
  { value: 'flat', label: 'Flat amount off' },
  { value: 'coupon', label: 'Coupon code' },
]

const KIND_LABEL: Record<PromoKind, string> = {
  percent: 'Percent off',
  flat: 'Flat off',
  coupon: 'Coupon',
}

function KindIcon({ kind, size = 14 }: { kind: PromoKind; size?: number }) {
  if (kind === 'percent') return <Percent size={size} aria-hidden />
  if (kind === 'flat') return <IndianRupee size={size} aria-hidden />
  return <Ticket size={size} aria-hidden />
}

/** Human label for a promo's value (e.g. "20% off" / "₹100 off"). */
function valueLabel(promo: Promo): string {
  return promo.kind === 'percent' ? `${promo.value}% off` : `${inr(promo.value)} off`
}

/** Human label for a happy-hour window, or null when the promo runs all day. */
function windowLabel(promo: Promo): string | null {
  if (promo.startHour === undefined || promo.endHour === undefined) return null
  const fmt = (h: number) => {
    const hr = ((Math.floor(h) % 24) + 24) % 24
    const period = hr < 12 ? 'am' : 'pm'
    const display = hr % 12 === 0 ? 12 : hr % 12
    return `${display}${period}`
  }
  return `${fmt(promo.startHour)}–${fmt(promo.endHour)}`
}

interface PromoRowProps {
  promo: Promo
  hour: number
  onToggle: () => void
  onDelete: () => void
}

function PromoRow({ promo, hour, onToggle, onDelete }: PromoRowProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const live = isPromoActive(promo, hour)
  const win = windowLabel(promo)

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex items-start gap-3 px-3.5 py-3"
        style={{ borderBottom: `1px solid ${t.ruleColor}` }}
      >
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center"
          style={{
            color: t.accent,
            background: 'rgba(42,30,30,0.05)',
            border: `1px solid ${t.ruleColor}`,
            borderRadius: hard ? 0 : 999,
          }}
          aria-hidden
        >
          <KindIcon kind={promo.kind} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[14px] font-semibold truncate"
              style={{ color: t.ink, fontFamily: t.descFont }}
            >
              {promo.name}
            </span>
            <span
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
              {KIND_LABEL[promo.kind]}
            </span>
            {live && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: '#3d6130',
                  background: 'rgba(79,122,60,0.12)',
                  border: '1px solid rgba(79,122,60,0.40)',
                  borderRadius: hard ? 0 : 999,
                  fontFamily: t.descFont,
                }}
              >
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#3d6130' }} />
                Live now
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-2 mt-1 text-[12px] flex-wrap"
            style={{ color: t.descColor, fontFamily: t.descFont }}
          >
            <span className="tabular-nums">{valueLabel(promo)}</span>
            {promo.code && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono uppercase">{promo.code}</span>
              </>
            )}
            {promo.singleUse && (
              <>
                <span aria-hidden>·</span>
                <span>Single-use</span>
              </>
            )}
            {win && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden /> {win}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <ToggleField label="Active" checked={promo.active} onChange={onToggle} />
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete promo ${promo.name}`}
            title="Delete promo"
          >
            <Trash2 size={13} aria-hidden />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

interface DraftState {
  name: string
  kind: PromoKind
  value: number
  code: string
  singleUse: boolean
  hasWindow: boolean
  startHour: number
  endHour: number
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  kind: 'percent',
  value: 10,
  code: '',
  singleUse: false,
  hasWindow: false,
  startHour: 16,
  endHour: 19,
}

export function Promotions() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()
  const promos = ops.state.promos

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [pendingDelete, setPendingDelete] = useState<Promo | null>(null)

  // The hour drives the "Live now" indicator; computed once per render.
  const hour = useMemo(() => new Date().getHours(), [])

  const activeCount = useMemo(() => promos.filter(p => p.active).length, [promos])
  const liveCount = useMemo(
    () => promos.filter(p => isPromoActive(p, hour)).length,
    [promos, hour],
  )

  const set = <K extends keyof DraftState>(key: K, val: DraftState[K]) =>
    setDraft(d => ({ ...d, [key]: val }))

  const canSubmit = draft.name.trim().length > 0 && Number.isFinite(draft.value) && draft.value > 0

  const submit = () => {
    if (!canSubmit) {
      push('Add a name and a value above 0', 'info')
      return
    }
    const code = draft.code.trim()
    const promo: Promo = {
      id: `promo-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      kind: draft.kind,
      value: Math.max(0, Math.round(draft.value)),
      code: code ? code.toUpperCase() : undefined,
      singleUse: draft.singleUse,
      active: true,
      startHour: draft.hasWindow ? Math.max(0, Math.min(23, Math.round(draft.startHour))) : undefined,
      endHour: draft.hasWindow ? Math.max(0, Math.min(23, Math.round(draft.endHour))) : undefined,
      createdAt: Date.now(),
    }
    ops.addPromo(promo)
    push(`Promo “${promo.name}” created`, 'success')
    setDraft(EMPTY_DRAFT)
  }

  const toggle = (p: Promo) => {
    ops.togglePromo(p.id)
    push(`${p.name} ${p.active ? 'paused' : 'activated'}`, p.active ? 'info' : 'success')
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    ops.deletePromo(pendingDelete.id)
    push(`Deleted “${pendingDelete.name}”`, 'info')
    setPendingDelete(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          Promotions
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Happy-hour windows, flat offers and coupon codes
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Promo list */}
        <Panel
          padded={false}
          title="Active promos"
          subtitle={`${activeCount} active · ${liveCount} live right now`}
        >
          {promos.length === 0 ? (
            <EmptyState
              icon={<Tags size={30} />}
              title="No promotions yet"
              description="Create your first offer using the form on the right."
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible">
              {promos.map(p => (
                <PromoRow
                  key={p.id}
                  promo={p}
                  hour={hour}
                  onToggle={() => toggle(p)}
                  onDelete={() => setPendingDelete(p)}
                />
              ))}
            </motion.div>
          )}
        </Panel>

        {/* Create form */}
        <Panel title="New promotion" className="h-fit">
          <form
            className="flex flex-col gap-4"
            onSubmit={e => {
              e.preventDefault()
              submit()
            }}
          >
            <TextField
              label="Name"
              value={draft.name}
              onChange={v => set('name', v)}
              placeholder="Weekend happy hour"
            />

            <SelectField
              label="Kind"
              value={draft.kind}
              onChange={v => set('kind', v as PromoKind)}
              options={KIND_OPTIONS}
            />

            <NumberField
              label={draft.kind === 'percent' ? 'Percent off' : 'Amount off (₹)'}
              value={draft.value}
              onChange={v => set('value', v)}
              min={0}
              prefix={draft.kind === 'percent' ? undefined : '₹'}
              hint={draft.kind === 'percent' ? '0–100%' : 'Whole rupees'}
            />

            {draft.kind === 'coupon' && (
              <TextField
                label="Coupon code"
                value={draft.code}
                onChange={v => set('code', v)}
                placeholder="RELISH20"
                hint="Shown uppercase to guests"
              />
            )}

            <ToggleField
              label="Single-use"
              description="One redemption per guest"
              checked={draft.singleUse}
              onChange={v => set('singleUse', v)}
            />

            <ToggleField
              label="Happy-hour window"
              description="Limit to a time of day"
              checked={draft.hasWindow}
              onChange={v => set('hasWindow', v)}
            />

            {draft.hasWindow && (
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Start hour"
                  value={draft.startHour}
                  onChange={v => set('startHour', v)}
                  min={0}
                  hint="0–23"
                />
                <NumberField
                  label="End hour"
                  value={draft.endHour}
                  onChange={v => set('endHour', v)}
                  min={0}
                  hint="0–23"
                />
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={!canSubmit}>
              <Plus size={15} aria-hidden /> Create promo
            </Button>
          </form>
        </Panel>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete promotion?"
        message={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
