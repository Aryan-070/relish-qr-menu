import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Receipt, Armchair, Plus, Minus, ClipboardList, Merge, ArrowRightLeft, Search } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useViewCtx } from '../ViewContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { Drawer } from '../components/Drawer'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NumberField, SelectField, TextField } from '../components/Field'
import { SegmentedControl } from '../components/SegmentedControl'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { TABLE_STATUS } from '../lib/statusColors'
import { sectionTitleStyle, isHard } from '../lib/skin'
import { ago, inr } from '../lib/format'
import { fadeUp, stagger } from '../../animations/variants'
import type { Table, TableStatus, OrderLine, OrderRecord } from '../lib/types'

// Status sub-states a waiter can flip an occupied table between.
type QuickStatus = 'seated' | 'ordering' | 'bill-requested'
const QUICK_OPTIONS: { value: QuickStatus; label: string }[] = [
  { value: 'seated', label: 'Seated' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'bill-requested', label: 'Bill' },
]

const SUMMARY_ITEMS: { key: TableStatus; label: string }[] = [
  { key: 'seated', label: 'Seated' },
  { key: 'ordering', label: 'Ordering' },
  { key: 'bill-requested', label: 'Bill requested' },
  { key: 'needs-attention', label: 'Needs attention' },
]

function SummaryStrip({ tables }: { tables: Table[] }) {
  const { tokens: t } = useTheme()
  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = {
      available: 0,
      seated: 0,
      ordering: 0,
      'bill-requested': 0,
      'needs-attention': 0,
    }
    for (const tb of tables) c[tb.status] += 1
    return c
  }, [tables])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {SUMMARY_ITEMS.map(it => {
        const s = TABLE_STATUS[it.key]
        return (
          <div
            key={it.key}
            className="flex flex-col gap-1 px-3.5 py-3"
            style={{ background: s.tint, border: `1px solid ${s.ring}`, borderRadius: isHard(t) ? 0 : 12 }}
          >
            <span className="text-[26px] leading-none font-bold" style={{ color: s.fg, fontFamily: t.headerFont }}>
              {counts[it.key]}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: s.fg, fontFamily: t.descFont }}>
              {it.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface TableCardProps {
  table: Table
  onSeat: (table: Table) => void
  onStatus: (table: Table, status: TableStatus) => void
  onOpenBill: (table: Table) => void
  onClear: (table: Table) => void
  onTakeOrder: (table: Table) => void
  onMerge: (table: Table) => void
  onTransfer: (table: Table) => void
}

function TableCard({
  table,
  onSeat,
  onStatus,
  onOpenBill,
  onClear,
  onTakeOrder,
  onMerge,
  onTransfer,
}: TableCardProps) {
  const { tokens: t } = useTheme()
  const available = table.status === 'available'
  const quickValue: QuickStatus =
    table.status === 'ordering' || table.status === 'bill-requested' ? table.status : 'seated'

  return (
    <motion.div variants={fadeUp}>
      <Panel className="h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[17px] leading-tight" style={sectionTitleStyle(t)}>
              {table.label}
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
              {table.zone} · {table.seats} seats
            </p>
          </div>
          <Badge status={TABLE_STATUS[table.status]} />
        </div>

        <div className="flex items-center gap-4 text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} aria-hidden /> {available ? 'No covers' : `${table.guests} covers`}
          </span>
          {!available && table.seatedAt != null && (
            <span className="opacity-80">Seated {ago(table.seatedAt)}</span>
          )}
        </div>

        {available ? (
          <div className="mt-auto">
            <Button variant="primary" size="md" fullWidth onClick={() => onSeat(table)}>
              <Users size={15} aria-hidden /> Seat guests
            </Button>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2.5">
            <SegmentedControl<QuickStatus>
              options={QUICK_OPTIONS}
              value={quickValue}
              onChange={v => onStatus(table, v)}
              ariaLabel={`Set ${table.label} status`}
              size="sm"
              className="w-full"
            />
            <Button variant="primary" size="sm" fullWidth onClick={() => onTakeOrder(table)}>
              <ClipboardList size={14} aria-hidden /> Take order
            </Button>
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={() => onOpenBill(table)} className="flex-1">
                <Receipt size={14} aria-hidden /> Open bill
              </Button>
              <Button variant="subtle" size="sm" onClick={() => onClear(table)} aria-label={`Clear ${table.label}`}>
                Clear
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="subtle" size="sm" onClick={() => onMerge(table)} className="flex-1">
                <Merge size={14} aria-hidden /> Merge
              </Button>
              <Button variant="subtle" size="sm" onClick={() => onTransfer(table)} className="flex-1">
                <ArrowRightLeft size={14} aria-hidden /> Transfer
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </motion.div>
  )
}

export function WaiterTables() {
  const { tokens: t } = useTheme()
  const { currentWaiterId, focusBilling } = useViewCtx()
  const ops = useOpsStore()
  const { push } = useToast()

  const assigned = useMemo(
    () => ops.state.tables.filter(tb => tb.waiterId === currentWaiterId),
    [ops.state.tables, currentWaiterId],
  )
  const showingFallback = assigned.length === 0
  const visibleTables = useMemo(() => {
    if (!showingFallback) return assigned
    return ops.state.tables.filter(tb => tb.status !== 'available')
  }, [showingFallback, assigned, ops.state.tables])

  const [seatTarget, setSeatTarget] = useState<Table | null>(null)
  const [guestCount, setGuestCount] = useState(2)
  const [clearTarget, setClearTarget] = useState<Table | null>(null)

  // Take-order drawer: target table + a cart keyed by menu item id → qty.
  const [orderTarget, setOrderTarget] = useState<Table | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [menuQuery, setMenuQuery] = useState('')

  // Merge / transfer modals.
  const [mergeTarget, setMergeTarget] = useState<Table | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [transferTarget, setTransferTarget] = useState<Table | null>(null)
  const [transferOrderId, setTransferOrderId] = useState('')
  const [transferToTable, setTransferToTable] = useState('')

  const openSeat = (table: Table) => {
    setGuestCount(2)
    setSeatTarget(table)
  }

  const confirmSeat = () => {
    if (!seatTarget) return
    const guests = Math.max(1, Math.round(guestCount))
    ops.seatTable(seatTarget.id, guests, currentWaiterId)
    push(`${seatTarget.label} seated · ${guests} covers`, 'success')
    setSeatTarget(null)
  }

  const changeStatus = (table: Table, status: TableStatus) => {
    if (table.status === status) return
    ops.setTableStatus(table.id, status)
    push(`${table.label} → ${TABLE_STATUS[status].label}`, 'info')
  }

  const confirmClear = () => {
    if (!clearTarget) return
    ops.clearTable(clearTarget.id)
    push(`${clearTarget.label} cleared`, 'success')
    setClearTarget(null)
  }

  // ── Take order ────────────────────────────────────────────────────────────
  const openOrder = (table: Table) => {
    setCart({})
    setMenuQuery('')
    setOrderTarget(table)
  }

  // Orderable menu: in-stock, available items only — mirrors what a guest sees.
  const orderableMenu = useMemo(
    () => ops.state.menu.filter(m => m.available && !m.soldOut),
    [ops.state.menu],
  )
  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase()
    if (!q) return orderableMenu
    return orderableMenu.filter(m => m.name.toLowerCase().includes(q))
  }, [orderableMenu, menuQuery])

  const addLine = (itemId: string) =>
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
  const removeLine = (itemId: string) =>
    setCart(prev => {
      const next = (prev[itemId] ?? 0) - 1
      if (next <= 0) {
        const { [itemId]: _drop, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: next }
    })

  const cartLines = useMemo<OrderLine[]>(() => {
    const lines: OrderLine[] = []
    for (const [itemId, qty] of Object.entries(cart)) {
      if (qty <= 0) continue
      const item = ops.state.menu.find(m => m.id === itemId)
      if (!item) continue
      lines.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        qty,
        categoryId: item.categoryId,
      })
    }
    return lines
  }, [cart, ops.state.menu])

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.price * l.qty, 0),
    [cartLines],
  )
  const cartCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.qty, 0),
    [cartLines],
  )

  const confirmOrder = () => {
    if (!orderTarget || cartLines.length === 0) return
    const order: OrderRecord = {
      id: `ORD-${String(Date.now()).slice(-6)}`,
      tableId: orderTarget.id,
      waiterId: orderTarget.waiterId ?? currentWaiterId,
      placedAt: Date.now(),
      lines: cartLines,
      total: cartTotal,
      paid: false,
      status: 'new',
      source: 'staff',
    }
    ops.placeOrder(order)
    push(`Order sent · ${orderTarget.label} · ${inr(cartTotal)}`, 'success')
    setOrderTarget(null)
    setCart({})
  }

  // ── Merge ─────────────────────────────────────────────────────────────────
  const openMerge = (table: Table) => {
    setMergeInto('')
    setMergeTarget(table)
  }
  // Candidate targets: any other table (not the source itself).
  const mergeOptions = useMemo(
    () =>
      mergeTarget
        ? ops.state.tables
            .filter(tb => tb.id !== mergeTarget.id)
            .map(tb => ({ value: tb.id, label: `${tb.label} · ${tb.zone}` }))
        : [],
    [mergeTarget, ops.state.tables],
  )
  const confirmMerge = () => {
    if (!mergeTarget || !mergeInto) return
    const into = ops.state.tables.find(tb => tb.id === mergeInto)
    ops.mergeTables(mergeTarget.id, mergeInto)
    push(`${mergeTarget.label} merged into ${into?.label ?? mergeInto}`, 'success')
    setMergeTarget(null)
  }

  // ── Transfer ───────────────────────────────────────────────────────────────
  const openTransfer = (table: Table) => {
    const open = ops.state.orders.filter(o => o.tableId === table.id && !o.paid)
    setTransferOrderId(open[0]?.id ?? '')
    setTransferToTable('')
    setTransferTarget(table)
  }
  const transferableOrders = useMemo(
    () =>
      transferTarget
        ? ops.state.orders.filter(o => o.tableId === transferTarget.id && !o.paid)
        : [],
    [transferTarget, ops.state.orders],
  )
  const transferTableOptions = useMemo(
    () =>
      transferTarget
        ? ops.state.tables
            .filter(tb => tb.id !== transferTarget.id)
            .map(tb => ({ value: tb.id, label: `${tb.label} · ${tb.zone}` }))
        : [],
    [transferTarget, ops.state.tables],
  )
  const confirmTransfer = () => {
    if (!transferTarget || !transferOrderId || !transferToTable) return
    const into = ops.state.tables.find(tb => tb.id === transferToTable)
    ops.transferOrder(transferOrderId, transferToTable)
    push(`${transferOrderId} moved to ${into?.label ?? transferToTable}`, 'success')
    setTransferTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
          My Tables
        </h1>
        <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {showingFallback
            ? 'Showing all tables (none assigned to you in demo)'
            : `${assigned.length} ${assigned.length === 1 ? 'table' : 'tables'} assigned to you`}
        </p>
      </div>

      <SummaryStrip tables={visibleTables} />

      {visibleTables.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Armchair size={30} />}
            title="No tables to show"
            description="Tables you are assigned to will appear here once guests are seated."
          />
        </Panel>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {visibleTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onSeat={openSeat}
              onStatus={changeStatus}
              onOpenBill={tb => focusBilling(tb.id)}
              onClear={tb => setClearTarget(tb)}
              onTakeOrder={openOrder}
              onMerge={openMerge}
              onTransfer={openTransfer}
            />
          ))}
        </motion.div>
      )}

      <Modal
        open={seatTarget != null}
        onClose={() => setSeatTarget(null)}
        title={seatTarget ? `Seat ${seatTarget.label}` : 'Seat table'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setSeatTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmSeat}>
              Confirm seating
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {seatTarget && (
            <p className="text-[13px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
              {seatTarget.zone} · {seatTarget.seats} seats available
            </p>
          )}
          <NumberField
            label="Guest count"
            value={guestCount}
            min={1}
            onChange={setGuestCount}
            hint="Number of covers being seated"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={clearTarget != null}
        title={clearTarget ? `Clear ${clearTarget.label}?` : 'Clear table?'}
        message="This frees the table and resets its covers. Any unpaid orders stay open in Billing."
        confirmLabel="Clear table"
        danger
        onConfirm={confirmClear}
        onCancel={() => setClearTarget(null)}
      />

      <Drawer
        open={orderTarget != null}
        onClose={() => setOrderTarget(null)}
        title={orderTarget ? `Take order · ${orderTarget.label}` : 'Take order'}
        width={460}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setOrderTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={confirmOrder}
              disabled={cartLines.length === 0}
            >
              Send order · {inr(cartTotal)}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            label="Find an item"
            value={menuQuery}
            onChange={setMenuQuery}
            placeholder="Search the menu…"
          />
          <p className="text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
            <Search size={12} className="inline -mt-0.5 mr-1" aria-hidden />
            {cartCount > 0
              ? `${cartCount} ${cartCount === 1 ? 'item' : 'items'} · ${inr(cartTotal)}`
              : 'Tap an item to add it to the order'}
          </p>

          <div className="flex flex-col gap-1.5">
            {filteredMenu.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={26} />}
                title="Nothing matches"
                description="No available menu items match your search."
              />
            ) : (
              filteredMenu.map(item => {
                const qty = cart[item.id] ?? 0
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                    style={{
                      border: `1px solid ${t.ruleColor}`,
                      borderRadius: isHard(t) ? 0 : 10,
                      background: qty > 0 ? TABLE_STATUS.ordering.tint : 'transparent',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: t.ink, fontFamily: t.descFont }}
                      >
                        {item.name}
                      </p>
                      <p className="text-[12px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
                        {inr(item.price)}
                      </p>
                    </div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => removeLine(item.id)}
                          aria-label={`Remove one ${item.name}`}
                        >
                          <Minus size={14} aria-hidden />
                        </Button>
                        <span
                          className="w-6 text-center text-[14px] font-bold"
                          style={{ color: t.ink, fontFamily: t.headerFont }}
                        >
                          {qty}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => addLine(item.id)}
                          aria-label={`Add one ${item.name}`}
                        >
                          <Plus size={14} aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => addLine(item.id)}
                        className="shrink-0"
                      >
                        <Plus size={14} aria-hidden /> Add
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Drawer>

      <Modal
        open={mergeTarget != null}
        onClose={() => setMergeTarget(null)}
        title={mergeTarget ? `Merge ${mergeTarget.label}` : 'Merge table'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setMergeTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmMerge} disabled={!mergeInto}>
              Merge tables
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
            Moves {mergeTarget?.label}&rsquo;s unpaid orders onto the target table and frees{' '}
            {mergeTarget?.label}.
          </p>
          <SelectField
            label="Merge into"
            value={mergeInto}
            onChange={setMergeInto}
            options={mergeOptions}
          />
        </div>
      </Modal>

      <Modal
        open={transferTarget != null}
        onClose={() => setTransferTarget(null)}
        title={transferTarget ? `Transfer from ${transferTarget.label}` : 'Transfer order'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={confirmTransfer}
              disabled={!transferOrderId || !transferToTable}
            >
              Transfer order
            </Button>
          </>
        }
      >
        {transferableOrders.length === 0 ? (
          <p className="text-[13px]" style={{ color: t.inkSoft, fontFamily: t.descFont }}>
            No unpaid orders on {transferTarget?.label} to transfer.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <SelectField
              label="Order"
              value={transferOrderId}
              onChange={setTransferOrderId}
              options={transferableOrders.map(o => ({
                value: o.id,
                label: `${o.id} · ${inr(o.total)}`,
              }))}
            />
            <SelectField
              label="Move to table"
              value={transferToTable}
              onChange={setTransferToTable}
              options={transferTableOptions}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
