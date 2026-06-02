import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useOpsStore } from '../store/useOpsStore'
import { useToast } from '../components/Toast'
import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { fadeUp, stagger } from '../../animations/variants'
import { inr } from '../lib/format'
import {
  PACKAGES,
  packageById,
  gstOf,
  withGst,
  formatDate,
  daysUntil,
  INVOICE_STATUS,
  type Invoice,
  type PackageId,
} from '../lib/billing'

export function BillingView() {
  const ops = useOpsStore()
  const toast = useToast()
  const { tokens: t } = useTheme()
  const { subscription: sub, invoices } = ops.state.billing
  const pkg = packageById(sub.packageId)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [choice, setChoice] = useState<PackageId>(sub.packageId)

  const lifetimeBilled = useMemo(
    () => invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    [invoices],
  )
  const renewalDays = daysUntil(sub.renewalAt)
  const renewalGst = gstOf(pkg.renewalYr)

  const columns: Column<Invoice>[] = useMemo(
    () => [
      { key: 'id', header: 'Invoice', sortValue: r => r.id, render: r => <span className="tabular-nums">{r.id}</span> },
      { key: 'date', header: 'Date', sortValue: r => r.date, render: r => formatDate(r.date) },
      { key: 'description', header: 'Description', sortValue: r => r.description, render: r => r.description },
      { key: 'base', header: 'Ex-GST', align: 'right', sortValue: r => r.base, render: r => <span className="tabular-nums">{inr(r.base)}</span> },
      { key: 'gst', header: 'GST 18%', align: 'right', sortValue: r => r.gst, render: r => <span className="tabular-nums">{inr(r.gst)}</span> },
      { key: 'total', header: 'Total', align: 'right', sortValue: r => r.total, render: r => <span className="tabular-nums font-semibold">{inr(r.total)}</span> },
      { key: 'status', header: 'Status', sortValue: r => r.status, render: r => <Badge status={INVOICE_STATUS[r.status]} /> },
    ],
    [],
  )

  function openPicker() {
    setChoice(sub.packageId)
    setPickerOpen(true)
  }
  function applyChange() {
    if (choice !== sub.packageId) {
      ops.billingSetPackage(choice)
      toast.push(`Switched to ${packageById(choice).name}`, 'success')
    }
    setPickerOpen(false)
  }
  function renewNow() {
    ops.billingRenewNow()
    toast.push('Renewal paid — thank you', 'success')
  }
  function toggleAuto() {
    const next = !sub.autoRenew
    ops.billingToggleAutoRenew()
    toast.push(next ? 'Auto-renew turned on' : 'Auto-renew turned off', 'info')
  }

  const label = { color: t.descColor, fontFamily: t.descFont }
  const value = { color: t.ink, fontFamily: t.descFont, fontWeight: 600 }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI summary */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <KpiCard label="Current package" value={pkg.name} />
        <KpiCard label="Annual renewal" value={inr(pkg.renewalYr)} />
        <KpiCard label="Next renewal" value={renewalDays >= 0 ? `${renewalDays}d` : 'Overdue'} />
        <KpiCard label="Lifetime billed" value={inr(lifetimeBilled)} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Subscription detail */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2">
          <Panel
            title="Subscription"
            subtitle={pkg.summary}
            action={<Button size="sm" variant="ghost" onClick={openPicker}>Change plan</Button>}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <div className="flex justify-between gap-3"><dt style={label}>Package</dt><dd style={value}>{pkg.name}</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>What's included</dt><dd style={value}>{pkg.video}</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>One-time build (paid)</dt><dd style={value} className="tabular-nums">{inr(pkg.oneTime)}</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>Started</dt><dd style={value}>{formatDate(sub.startedAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>Annual renewal</dt><dd style={value} className="tabular-nums">{inr(pkg.renewalYr)} + GST</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>Next renewal</dt><dd style={value}>{formatDate(sub.renewalAt)}</dd></div>
            </dl>

            <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
              <span className="text-[13px]" style={label}>
                Auto-renew is <span style={{ color: sub.autoRenew ? '#3d6130' : '#b3141b', fontWeight: 600 }}>{sub.autoRenew ? 'on' : 'off'}</span>
              </span>
              <Button size="sm" variant="subtle" onClick={toggleAuto}>
                {sub.autoRenew ? 'Turn off' : 'Turn on'}
              </Button>
            </div>
          </Panel>
        </motion.div>

        {/* Next charge / renew */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Panel title="Next charge">
            <dl className="text-[13px] flex flex-col gap-2.5">
              <div className="flex justify-between gap-3"><dt style={label}>Renewal (ex-GST)</dt><dd style={value} className="tabular-nums">{inr(pkg.renewalYr)}</dd></div>
              <div className="flex justify-between gap-3"><dt style={label}>GST 18%</dt><dd style={value} className="tabular-nums">{inr(renewalGst)}</dd></div>
              <div className="flex justify-between gap-3 pt-2.5" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
                <dt style={{ ...label, color: t.ink, fontWeight: 600 }}>Total due</dt>
                <dd className="tabular-nums" style={{ color: t.accent, fontFamily: t.headerFont, fontWeight: 700, fontSize: 18 }}>{inr(withGst(pkg.renewalYr))}</dd>
              </div>
              <div className="flex justify-between gap-3"><dt style={label}>Due on</dt><dd style={value}>{formatDate(sub.renewalAt)}</dd></div>
            </dl>
            <Button size="sm" variant="primary" fullWidth className="mt-4" onClick={renewNow}>Renew now</Button>
            <p className="text-[11px] mt-3 leading-snug" style={{ color: t.descColor, fontFamily: t.descFont }}>
              Demo billing — charges simulate locally. Razorpay subscriptions &amp; GST invoicing connect in the next release.
            </p>
          </Panel>
        </motion.div>
      </div>

      {/* Invoice history */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Panel title="Invoice history" subtitle={`${invoices.length} invoices`}>
          <DataTable
            columns={columns}
            rows={invoices}
            rowKey={r => r.id}
            initialSortKey="date"
            initialSortDir="desc"
            caption="Billing invoice history"
            emptyLabel="No invoices yet"
          />
        </Panel>
      </motion.div>

      {/* Change-plan picker */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Change plan"
        width={460}
        footer={
          <>
            <Button size="sm" variant="subtle" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={applyChange} disabled={choice === sub.packageId}>Confirm change</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {PACKAGES.map(p => {
            const active = p.id === choice
            return (
              <button
                key={p.id}
                onClick={() => setChoice(p.id)}
                className="text-left p-3 rounded-lg transition-colors cursor-pointer"
                style={{
                  border: `1px solid ${active ? t.accent : t.ruleColor}`,
                  background: active ? 'rgba(110,31,44,0.06)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}>
                    {p.name}
                    {p.id === sub.packageId && <span className="text-[11px] ml-2" style={{ color: t.descColor }}>(current)</span>}
                  </span>
                  <span className="tabular-nums" style={{ color: t.accent, fontWeight: 700 }}>{inr(p.oneTime)}</span>
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: t.descColor }}>
                  {p.summary} · {inr(p.renewalYr)}/yr · {p.video}
                </div>
              </button>
            )
          })}
        </div>
        {choice !== sub.packageId && packageById(choice).oneTime > pkg.oneTime && (
          <p className="text-[12px] mt-3" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Upgrade difference billed now: {inr(withGst(packageById(choice).oneTime - pkg.oneTime))} (incl. GST).
          </p>
        )}
      </Modal>
    </div>
  )
}
