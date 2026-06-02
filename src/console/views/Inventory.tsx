import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Boxes,
  PackagePlus,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { useToast } from '../components/Toast'
import { Panel } from '../components/Panel'
import { KpiCard } from '../components/KpiCard'
import { DataTable, type Column } from '../components/DataTable'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Drawer } from '../components/Drawer'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { TextField, NumberField, SelectField } from '../components/Field'
import { fadeUp, stagger } from '../../animations/variants'
import { panelStyle } from '../lib/skin'
import { inr, inrCompact, ago } from '../lib/format'
import type { StatusStyle } from '../lib/statusColors'
import type {
  Ingredient,
  PurchaseOrder,
  Recipe,
  RecipeLine,
} from '../lib/types'

// Reusable status pills (Badge takes a StatusStyle, mirroring statusColors.ts).
const LOW_STOCK: StatusStyle = {
  label: 'Low stock',
  fg: '#b3141b',
  tint: 'rgba(215,25,32,0.12)',
  ring: 'rgba(215,25,32,0.50)',
}
const IN_STOCK: StatusStyle = {
  label: 'In stock',
  fg: '#3d6130',
  tint: 'rgba(79,122,60,0.12)',
  ring: 'rgba(79,122,60,0.40)',
}
const PO_STATUS: Record<PurchaseOrder['status'], StatusStyle> = {
  draft: { label: 'Draft', fg: '#4a3f3a', tint: 'rgba(74,63,58,0.10)', ring: 'rgba(74,63,58,0.32)' },
  ordered: { label: 'Ordered', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  received: { label: 'Received', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
}

type Tab = 'stock' | 'recipes' | 'suppliers' | 'orders' | 'wastage'

const TAB_OPTIONS: Array<{ value: Tab; label: string }> = [
  { value: 'stock', label: 'Stock' },
  { value: 'recipes', label: 'Recipes' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'orders', label: 'Purchase orders' },
  { value: 'wastage', label: 'Wastage' },
]

/** Cost of one serving of an item, from its recipe + ingredient unit costs. */
function recipeCost(recipe: Recipe | undefined, byId: Map<string, Ingredient>): number {
  if (!recipe) return 0
  return recipe.lines.reduce((sum, l) => {
    const ing = byId.get(l.ingredientId)
    return sum + (ing ? ing.costPerUnit * l.qty : 0)
  }, 0)
}

export function Inventory() {
  const ops = useOpsStore()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('stock')

  const { ingredients, recipes, suppliers, purchaseOrders, wastage, menu } = ops.state

  const byId = useMemo(() => {
    const m = new Map<string, Ingredient>()
    for (const i of ingredients) m.set(i.id, i)
    return m
  }, [ingredients])

  const ingName = (id: string) => byId.get(id)?.name ?? id
  const itemName = (id: string) => menu.find(m => m.id === id)?.name ?? id
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? id

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const lowCount = useMemo(
    () => ingredients.filter(i => i.stock <= i.lowThreshold).length,
    [ingredients],
  )
  const stockValue = useMemo(
    () => ingredients.reduce((sum, i) => sum + i.stock * i.costPerUnit, 0),
    [ingredients],
  )
  // Average plate cost across all dishes that have a recipe.
  const avgPlateCost = useMemo(() => {
    if (recipes.length === 0) return 0
    const total = recipes.reduce((s, r) => s + recipeCost(r, byId), 0)
    return total / recipes.length
  }, [recipes, byId])
  // Blended food-cost % = sum(recipe cost) / sum(menu price) over costed dishes.
  const foodCostPct = useMemo(() => {
    let cost = 0
    let price = 0
    for (const r of recipes) {
      const item = menu.find(m => m.id === r.itemId)
      if (!item || item.price <= 0) continue
      cost += recipeCost(r, byId)
      price += item.price
    }
    return price > 0 ? Math.round((cost / price) * 100) : 0
  }, [recipes, menu, byId])

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Stock on hand" value={stockValue} format={inrCompact} />
        <KpiCard label="Low-stock items" value={lowCount} goodWhenUp={false} />
        <KpiCard label="Avg plate cost" value={avgPlateCost} format={inr} />
        <KpiCard label="Food cost %" value={foodCostPct} format={n => `${n}%`} goodWhenUp={false} />
      </div>

      {/* Tab switcher */}
      <div className="overflow-x-auto">
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
          ariaLabel="Inventory section"
          size="sm"
        />
      </div>

      {tab === 'stock' && (
        <StockPanel
          ingredients={ingredients}
          suppliers={suppliers}
          onAdd={ing => {
            ops.addIngredient(ing)
            push(`${ing.name} added to inventory`, 'success')
          }}
          onAdjust={(id, patch, name) => {
            ops.updateIngredient(id, patch)
            push(`${name} updated`, 'info')
          }}
          supplierName={supplierName}
        />
      )}

      {tab === 'recipes' && (
        <RecipesPanel
          recipes={recipes}
          menu={menu}
          ingredients={ingredients}
          byId={byId}
          ingName={ingName}
          itemName={itemName}
          onSave={(itemId, lines, name) => {
            ops.setRecipe(itemId, lines)
            push(`Recipe for ${name} saved`, 'success')
          }}
        />
      )}

      {tab === 'suppliers' && (
        <SuppliersPanel
          ops={ops}
          onAdded={name => push(`Supplier ${name} added`, 'success')}
        />
      )}

      {tab === 'orders' && (
        <OrdersPanel
          purchaseOrders={purchaseOrders}
          ingredients={ingredients}
          suppliers={suppliers}
          supplierName={supplierName}
          ingName={ingName}
          onCreate={(po, sName) => {
            ops.addPurchaseOrder(po)
            push(`Draft PO created for ${sName}`, 'success')
          }}
          onReceive={(id, sName) => {
            ops.receivePurchaseOrder(id)
            push(`PO from ${sName} received — stock updated`, 'success')
          }}
        />
      )}

      {tab === 'wastage' && (
        <WastagePanel
          wastage={wastage}
          ingredients={ingredients}
          ingName={ingName}
          byId={byId}
          onLog={(ingredientId, qty, reason, name) => {
            ops.logWastage(ingredientId, qty, reason)
            push(`Logged ${qty} ${byId.get(ingredientId)?.unit ?? ''} ${name} wastage`, 'warn')
          }}
        />
      )}
    </motion.div>
  )
}

// ── Stock / ingredients ──────────────────────────────────────────────────────

interface StockPanelProps {
  ingredients: Ingredient[]
  suppliers: { id: string; name: string }[]
  onAdd: (ing: Ingredient) => void
  onAdjust: (id: string, patch: Partial<Ingredient>, name: string) => void
  supplierName: (id: string) => string
}

function StockPanel({ ingredients, suppliers, onAdd, onAdjust, supplierName }: StockPanelProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)

  const columns: Column<Ingredient>[] = [
    {
      key: 'name',
      header: 'Ingredient',
      sortValue: r => r.name,
      render: r => (
        <span className="inline-flex items-center gap-2">
          {r.name}
          {r.stock <= r.lowThreshold && <Badge status={LOW_STOCK} label="Low" />}
        </span>
      ),
    },
    { key: 'stock', header: 'Stock', align: 'right', sortValue: r => r.stock, render: r => `${r.stock} ${r.unit}` },
    { key: 'low', header: 'Reorder at', align: 'right', sortValue: r => r.lowThreshold, render: r => `${r.lowThreshold} ${r.unit}` },
    { key: 'cost', header: 'Unit cost', align: 'right', sortValue: r => r.costPerUnit, render: r => `${inr(r.costPerUnit)}/${r.unit}` },
    { key: 'value', header: 'Value', align: 'right', sortValue: r => r.stock * r.costPerUnit, render: r => inr(r.stock * r.costPerUnit) },
    {
      key: 'supplier',
      header: 'Supplier',
      sortValue: r => (r.supplierId ? supplierName(r.supplierId) : ''),
      render: r => (r.supplierId ? supplierName(r.supplierId) : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: r => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={`Adjust ${r.name}`}>
          Adjust
        </Button>
      ),
    },
  ]

  return (
    <>
      <Panel
        title="Ingredients"
        subtitle={`${ingredients.length} tracked · ${ingredients.filter(i => i.stock <= i.lowThreshold).length} low`}
        action={
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} aria-label="Add ingredient">
            <Plus size={14} aria-hidden /> Add ingredient
          </Button>
        }
      >
        {ingredients.length === 0 ? (
          <EmptyState
            icon={<Boxes size={28} />}
            title="No ingredients yet"
            description="Add ingredients to track stock and power recipe costing."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={ingredients}
            rowKey={r => r.id}
            caption="Ingredient stock levels"
            initialSortKey="value"
          />
        )}
      </Panel>

      <IngredientModal
        open={adding}
        suppliers={suppliers}
        onClose={() => setAdding(false)}
        onSubmit={ing => {
          onAdd(ing)
          setAdding(false)
        }}
      />

      <AdjustStockModal
        ingredient={editing}
        onClose={() => setEditing(null)}
        onSubmit={(patch, name) => {
          if (editing) onAdjust(editing.id, patch, name)
          setEditing(null)
        }}
      />
    </>
  )
}

interface IngredientModalProps {
  open: boolean
  suppliers: { id: string; name: string }[]
  onClose: () => void
  onSubmit: (ing: Ingredient) => void
}

function IngredientModal({ open, suppliers, onClose, onSubmit }: IngredientModalProps) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [stock, setStock] = useState(0)
  const [lowThreshold, setLowThreshold] = useState(0)
  const [costPerUnit, setCostPerUnit] = useState(0)
  const [supplierId, setSupplierId] = useState('')

  const reset = () => {
    setName(''); setUnit('kg'); setStock(0); setLowThreshold(0); setCostPerUnit(0); setSupplierId('')
  }
  const close = () => { reset(); onClose() }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({
      id: `ing-${Date.now().toString(36)}`,
      name: trimmed,
      unit: unit.trim() || 'unit',
      stock,
      lowThreshold,
      costPerUnit,
      supplierId: supplierId || undefined,
    })
    reset()
  }

  const supplierOptions = [{ value: '', label: 'No supplier' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add ingredient"
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()}>Add</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Paneer" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Unit" value={unit} onChange={setUnit} placeholder="kg / ltr / unit" />
          <NumberField label="Stock" value={stock} onChange={setStock} />
          <NumberField label="Reorder at" value={lowThreshold} onChange={setLowThreshold} hint="Low-stock threshold" />
          <NumberField label="Unit cost" value={costPerUnit} onChange={setCostPerUnit} prefix="₹" />
        </div>
        <SelectField label="Supplier" value={supplierId} onChange={setSupplierId} options={supplierOptions} />
      </div>
    </Modal>
  )
}

interface AdjustStockModalProps {
  ingredient: Ingredient | null
  onClose: () => void
  onSubmit: (patch: Partial<Ingredient>, name: string) => void
}

function AdjustStockModal({ ingredient, onClose, onSubmit }: AdjustStockModalProps) {
  const [stock, setStock] = useState(0)
  const [lowThreshold, setLowThreshold] = useState(0)
  const [costPerUnit, setCostPerUnit] = useState(0)

  // Re-seed local state when a new ingredient is opened.
  const [seededId, setSeededId] = useState<string | null>(null)
  if (ingredient && ingredient.id !== seededId) {
    setSeededId(ingredient.id)
    setStock(ingredient.stock)
    setLowThreshold(ingredient.lowThreshold)
    setCostPerUnit(ingredient.costPerUnit)
  }

  const close = () => { setSeededId(null); onClose() }

  return (
    <Modal
      open={!!ingredient}
      onClose={close}
      title={ingredient ? `Adjust ${ingredient.name}` : 'Adjust'}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (ingredient) onSubmit({ stock, lowThreshold, costPerUnit }, ingredient.name)
              setSeededId(null)
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {ingredient && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={`Stock (${ingredient.unit})`} value={stock} onChange={setStock} />
          <NumberField label="Reorder at" value={lowThreshold} onChange={setLowThreshold} />
          <NumberField label="Unit cost" value={costPerUnit} onChange={setCostPerUnit} prefix="₹" />
        </div>
      )}
    </Modal>
  )
}

// ── Recipes (BOM per menu item) ──────────────────────────────────────────────

interface RecipesPanelProps {
  recipes: Recipe[]
  menu: { id: string; name: string; price: number }[]
  ingredients: Ingredient[]
  byId: Map<string, Ingredient>
  ingName: (id: string) => string
  itemName: (id: string) => string
  onSave: (itemId: string, lines: RecipeLine[], name: string) => void
}

interface RecipeRow {
  itemId: string
  name: string
  price: number
  cost: number
  marginPct: number
  lineCount: number
  hasRecipe: boolean
}

function RecipesPanel({ recipes, menu, ingredients, byId, ingName, itemName, onSave }: RecipesPanelProps) {
  const [editing, setEditing] = useState<string | null>(null)

  const rows = useMemo<RecipeRow[]>(() => {
    return menu.map(item => {
      const recipe = recipes.find(r => r.itemId === item.id)
      const cost = recipeCost(recipe, byId)
      const marginPct = item.price > 0 ? Math.round(((item.price - cost) / item.price) * 100) : 0
      return {
        itemId: item.id,
        name: item.name,
        price: item.price,
        cost,
        marginPct,
        lineCount: recipe?.lines.length ?? 0,
        hasRecipe: !!recipe,
      }
    })
  }, [menu, recipes, byId])

  const columns: Column<RecipeRow>[] = [
    { key: 'name', header: 'Dish', sortValue: r => r.name, render: r => r.name },
    { key: 'lines', header: 'Ingredients', align: 'right', sortValue: r => r.lineCount, render: r => (r.hasRecipe ? r.lineCount : '—') },
    { key: 'cost', header: 'Plate cost', align: 'right', sortValue: r => r.cost, render: r => (r.hasRecipe ? inr(r.cost) : '—') },
    { key: 'price', header: 'Menu price', align: 'right', sortValue: r => r.price, render: r => inr(r.price) },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: r => r.marginPct,
      render: r =>
        r.hasRecipe ? (
          <Badge status={r.marginPct >= 60 ? IN_STOCK : LOW_STOCK} dot={false} label={`${r.marginPct}%`} />
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: r => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(r.itemId)} aria-label={`Edit recipe for ${r.name}`}>
          {r.hasRecipe ? 'Edit BOM' : 'Add BOM'}
        </Button>
      ),
    },
  ]

  const editItem = editing ? menu.find(m => m.id === editing) : undefined

  return (
    <>
      <Panel title="Recipes & bill of materials" subtitle="Per-serving ingredient breakdown drives auto-deduction and plate cost.">
        {menu.length === 0 ? (
          <EmptyState title="No dishes" description="Add menu items to define recipes." />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={r => r.itemId} caption="Recipe costs and margins" initialSortKey="margin" initialSortDir="asc" />
        )}
      </Panel>

      <RecipeEditorDrawer
        open={!!editItem}
        itemId={editItem?.id ?? null}
        itemLabel={editItem ? itemName(editItem.id) : ''}
        price={editItem?.price ?? 0}
        existing={editing ? recipes.find(r => r.itemId === editing)?.lines ?? [] : []}
        ingredients={ingredients}
        byId={byId}
        ingName={ingName}
        onClose={() => setEditing(null)}
        onSave={(lines, name) => {
          if (editItem) onSave(editItem.id, lines, name)
          setEditing(null)
        }}
      />
    </>
  )
}

interface RecipeEditorDrawerProps {
  open: boolean
  itemId: string | null
  itemLabel: string
  price: number
  existing: RecipeLine[]
  ingredients: Ingredient[]
  byId: Map<string, Ingredient>
  ingName: (id: string) => string
  onClose: () => void
  onSave: (lines: RecipeLine[], name: string) => void
}

function RecipeEditorDrawer({
  open,
  itemId,
  itemLabel,
  price,
  existing,
  ingredients,
  byId,
  onClose,
  onSave,
}: RecipeEditorDrawerProps) {
  const { tokens: t } = useTheme()
  const [lines, setLines] = useState<RecipeLine[]>([])
  const [seededId, setSeededId] = useState<string | null>(null)
  const [picker, setPicker] = useState('')

  if (itemId && itemId !== seededId) {
    setSeededId(itemId)
    setLines(existing)
    setPicker('')
  }

  const cost = useMemo(
    () => lines.reduce((s, l) => s + (byId.get(l.ingredientId)?.costPerUnit ?? 0) * l.qty, 0),
    [lines, byId],
  )
  const marginPct = price > 0 ? Math.round(((price - cost) / price) * 100) : 0

  const available = ingredients.filter(i => !lines.some(l => l.ingredientId === i.id))
  const pickerOptions = [
    { value: '', label: 'Add an ingredient…' },
    ...available.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` })),
  ]

  const addLine = (ingredientId: string) => {
    if (!ingredientId) return
    setLines(prev => [...prev, { ingredientId, qty: 0 }])
    setPicker('')
  }
  const setQty = (ingredientId: string, qty: number) =>
    setLines(prev => prev.map(l => (l.ingredientId === ingredientId ? { ...l, qty } : l)))
  const removeLine = (ingredientId: string) =>
    setLines(prev => prev.filter(l => l.ingredientId !== ingredientId))

  const close = () => { setSeededId(null); onClose() }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`Recipe — ${itemLabel}`}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { onSave(lines, itemLabel); setSeededId(null) }}>
            Save recipe
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {lines.length === 0 ? (
          <p className="text-[13px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
            No ingredients yet. Add one below to start building the bill of materials.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {lines.map(l => {
              const ing = byId.get(l.ingredientId)
              return (
                <div
                  key={l.ingredientId}
                  style={panelStyle(t)}
                  className="p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
                      {ing?.name ?? l.ingredientId}
                    </span>
                    <span className="block text-[11px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
                      {inr(ing?.costPerUnit ?? 0)}/{ing?.unit ?? 'unit'} · line {inr((ing?.costPerUnit ?? 0) * l.qty)}
                    </span>
                  </div>
                  <div className="w-24">
                    <NumberField label={`Qty (${ing?.unit ?? ''})`} value={l.qty} onChange={v => setQty(l.ingredientId, v)} />
                  </div>
                  <Button variant="danger" size="sm" onClick={() => removeLine(l.ingredientId)} aria-label="Remove ingredient">
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {available.length > 0 && (
          <SelectField label="Add ingredient" value={picker} onChange={v => { setPicker(v); addLine(v) }} options={pickerOptions} />
        )}

        {/* Cost summary */}
        <div style={panelStyle(t)} className="p-3.5 flex flex-col gap-1.5">
          <Row label="Plate cost" value={inr(cost)} t={t} />
          <Row label="Menu price" value={inr(price)} t={t} />
          <Row label="Margin" value={`${marginPct}%`} t={t} strong />
        </div>
      </div>
    </Drawer>
  )
}

function Row({ label, value, t, strong }: { label: string; value: string; t: ReturnType<typeof useTheme>['tokens']; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ fontFamily: t.descFont, color: t.descColor }}>{label}</span>
      <span
        className="text-[13px] tabular-nums"
        style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", color: t.ink, fontWeight: strong ? 700 : 500 }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Suppliers ────────────────────────────────────────────────────────────────

interface SuppliersPanelProps {
  ops: ReturnType<typeof useOpsStore>
  onAdded: (name: string) => void
}

function SuppliersPanel({ ops, onAdded }: SuppliersPanelProps) {
  const { suppliers, ingredients } = ops.state
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const reset = () => { setName(''); setPhone(''); setEmail('') }
  const close = () => { reset(); setAdding(false) }
  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    ops.addSupplier({
      id: `sup-${Date.now().toString(36)}`,
      name: trimmed,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    })
    onAdded(trimmed)
    reset()
    setAdding(false)
  }

  const columns: Column<{ id: string; name: string; phone?: string; email?: string }>[] = [
    { key: 'name', header: 'Supplier', sortValue: r => r.name, render: r => r.name },
    { key: 'phone', header: 'Phone', render: r => r.phone ?? '—' },
    { key: 'email', header: 'Email', render: r => r.email ?? '—' },
    {
      key: 'items',
      header: 'Ingredients',
      align: 'right',
      sortValue: r => ingredients.filter(i => i.supplierId === r.id).length,
      render: r => ingredients.filter(i => i.supplierId === r.id).length,
    },
  ]

  return (
    <>
      <Panel
        title="Suppliers"
        subtitle={`${suppliers.length} vendors`}
        action={
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} aria-label="Add supplier">
            <Plus size={14} aria-hidden /> Add supplier
          </Button>
        }
      >
        {suppliers.length === 0 ? (
          <EmptyState icon={<Truck size={28} />} title="No suppliers" description="Add vendors to attach ingredients and raise purchase orders." />
        ) : (
          <DataTable columns={columns} rows={suppliers} rowKey={r => r.id} caption="Suppliers" initialSortKey="name" initialSortDir="asc" />
        )}
      </Panel>

      <Modal
        open={adding}
        onClose={close}
        title="Add supplier"
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()}>Add</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <TextField label="Name" value={name} onChange={setName} placeholder="e.g. FreshFarm Produce Co." />
          <TextField label="Phone" value={phone} onChange={setPhone} placeholder="+91 …" />
          <TextField label="Email" value={email} onChange={setEmail} placeholder="orders@vendor.in" />
        </div>
      </Modal>
    </>
  )
}

// ── Purchase orders ──────────────────────────────────────────────────────────

interface OrdersPanelProps {
  purchaseOrders: PurchaseOrder[]
  ingredients: Ingredient[]
  suppliers: { id: string; name: string }[]
  supplierName: (id: string) => string
  ingName: (id: string) => string
  onCreate: (po: PurchaseOrder, supplierName: string) => void
  onReceive: (id: string, supplierName: string) => void
}

function OrdersPanel({ purchaseOrders, ingredients, suppliers, supplierName, ingName, onCreate, onReceive }: OrdersPanelProps) {
  const { tokens: t } = useTheme()
  const [creating, setCreating] = useState(false)

  const poTotal = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty * l.cost, 0)

  return (
    <>
      <Panel
        title="Purchase orders"
        subtitle={`${purchaseOrders.filter(p => p.status !== 'received').length} open`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreating(true)}
            disabled={suppliers.length === 0 || ingredients.length === 0}
            aria-label="Create purchase order"
          >
            <PackagePlus size={14} aria-hidden /> New draft PO
          </Button>
        }
      >
        {purchaseOrders.length === 0 ? (
          <EmptyState title="No purchase orders" description="Raise a draft PO, then receive it to restock automatically." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {purchaseOrders.map(po => (
              <motion.div key={po.id} variants={fadeUp} style={panelStyle(t)} className="p-3.5 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold" style={{ fontFamily: t.headerFont, color: t.ink }}>
                        {supplierName(po.supplierId)}
                      </span>
                      <Badge status={PO_STATUS[po.status]} />
                    </div>
                    <span className="text-[11px]" style={{ fontFamily: t.descFont, color: t.descColor }}>
                      {po.id} · raised {ago(po.createdAt)}
                      {po.receivedAt ? ` · received ${ago(po.receivedAt)}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[14px] tabular-nums" style={{ fontFamily: t.priceFont, color: t.ink, fontWeight: 600 }}>
                      {inr(poTotal(po))}
                    </span>
                    {po.status !== 'received' && (
                      <Button variant="primary" size="sm" onClick={() => onReceive(po.id, supplierName(po.supplierId))} aria-label={`Receive ${po.id}`}>
                        Receive
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {po.lines.map(l => (
                    <span
                      key={l.ingredientId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px]"
                      style={{
                        fontFamily: t.descFont,
                        color: t.inkSoft,
                        background: 'rgba(0,0,0,0.03)',
                        border: `1px solid ${t.ruleColor}`,
                        borderRadius: 999,
                      }}
                    >
                      {ingName(l.ingredientId)} × {l.qty}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>

      <CreatePoModal
        open={creating}
        ingredients={ingredients}
        suppliers={suppliers}
        onClose={() => setCreating(false)}
        onSubmit={(po, sName) => { onCreate(po, sName); setCreating(false) }}
      />
    </>
  )
}

interface CreatePoModalProps {
  open: boolean
  ingredients: Ingredient[]
  suppliers: { id: string; name: string }[]
  onClose: () => void
  onSubmit: (po: PurchaseOrder, supplierName: string) => void
}

function CreatePoModal({ open, ingredients, suppliers, onClose, onSubmit }: CreatePoModalProps) {
  const { tokens: t } = useTheme()
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<{ ingredientId: string; qty: number; cost: number }[]>([])
  const [picker, setPicker] = useState('')

  const reset = () => { setSupplierId(''); setLines([]); setPicker('') }
  const close = () => { reset(); onClose() }

  const supplierOptions = [
    { value: '', label: 'Select supplier…' },
    ...suppliers.map(s => ({ value: s.id, label: s.name })),
  ]
  // Default the line to ingredients tied to the chosen supplier first.
  const candidates = ingredients.filter(i => !lines.some(l => l.ingredientId === i.id))
  const pickerOptions = [
    { value: '', label: 'Add a line…' },
    ...candidates.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` })),
  ]

  const addLine = (ingredientId: string) => {
    if (!ingredientId) return
    const ing = ingredients.find(i => i.id === ingredientId)
    setLines(prev => [...prev, { ingredientId, qty: 0, cost: ing?.costPerUnit ?? 0 }])
    setPicker('')
  }
  const patchLine = (ingredientId: string, patch: Partial<{ qty: number; cost: number }>) =>
    setLines(prev => prev.map(l => (l.ingredientId === ingredientId ? { ...l, ...patch } : l)))
  const removeLine = (ingredientId: string) =>
    setLines(prev => prev.filter(l => l.ingredientId !== ingredientId))

  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0)
  const canSubmit = !!supplierId && lines.length > 0

  const submit = () => {
    if (!canSubmit) return
    const sName = suppliers.find(s => s.id === supplierId)?.name ?? supplierId
    onSubmit(
      {
        id: `po-${Date.now().toString(36)}`,
        supplierId,
        lines,
        status: 'draft',
        createdAt: Date.now(),
      },
      sName,
    )
    reset()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New purchase order"
      width={520}
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!canSubmit}>
            Create draft · {inr(total)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <SelectField label="Supplier" value={supplierId} onChange={setSupplierId} options={supplierOptions} />

        {lines.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {lines.map(l => {
              const ing = ingredients.find(i => i.id === l.ingredientId)
              return (
                <div key={l.ingredientId} style={panelStyle(t)} className="p-3 flex items-end gap-3">
                  <span className="flex-1 min-w-0 text-[13px] font-semibold pb-2 truncate" style={{ fontFamily: t.descFont, color: t.ink }}>
                    {ing?.name ?? l.ingredientId}
                  </span>
                  <div className="w-20">
                    <NumberField label={`Qty (${ing?.unit ?? ''})`} value={l.qty} onChange={v => patchLine(l.ingredientId, { qty: v })} />
                  </div>
                  <div className="w-24">
                    <NumberField label="Unit cost" value={l.cost} onChange={v => patchLine(l.ingredientId, { cost: v })} prefix="₹" />
                  </div>
                  <Button variant="danger" size="sm" onClick={() => removeLine(l.ingredientId)} aria-label="Remove line">
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {candidates.length > 0 && (
          <SelectField label="Add line item" value={picker} onChange={v => { setPicker(v); addLine(v) }} options={pickerOptions} />
        )}
      </div>
    </Modal>
  )
}

// ── Wastage ──────────────────────────────────────────────────────────────────

interface WastagePanelProps {
  wastage: { id: string; ingredientId: string; qty: number; reason: string; createdAt: number }[]
  ingredients: Ingredient[]
  ingName: (id: string) => string
  byId: Map<string, Ingredient>
  onLog: (ingredientId: string, qty: number, reason: string, name: string) => void
}

function WastagePanel({ wastage, ingredients, ingName, byId, onLog }: WastagePanelProps) {
  const [logging, setLogging] = useState(false)
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState(0)
  const [reason, setReason] = useState('')

  const reset = () => { setIngredientId(''); setQty(0); setReason('') }
  const close = () => { reset(); setLogging(false) }
  const submit = () => {
    if (!ingredientId || qty <= 0) return
    onLog(ingredientId, qty, reason.trim() || 'Spoilage', ingName(ingredientId))
    reset()
    setLogging(false)
  }

  const totalCost = useMemo(
    () => wastage.reduce((s, w) => s + (byId.get(w.ingredientId)?.costPerUnit ?? 0) * w.qty, 0),
    [wastage, byId],
  )

  const options = [
    { value: '', label: 'Select ingredient…' },
    ...ingredients.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` })),
  ]

  interface WRow { id: string; ingredientId: string; qty: number; reason: string; createdAt: number }
  const columns: Column<WRow>[] = [
    { key: 'ing', header: 'Ingredient', sortValue: r => ingName(r.ingredientId), render: r => ingName(r.ingredientId) },
    { key: 'qty', header: 'Qty', align: 'right', sortValue: r => r.qty, render: r => `${r.qty} ${byId.get(r.ingredientId)?.unit ?? ''}` },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: r => (byId.get(r.ingredientId)?.costPerUnit ?? 0) * r.qty, render: r => inr((byId.get(r.ingredientId)?.costPerUnit ?? 0) * r.qty) },
    { key: 'reason', header: 'Reason', render: r => r.reason },
    { key: 'when', header: 'When', align: 'right', sortValue: r => r.createdAt, render: r => ago(r.createdAt) },
  ]

  return (
    <>
      <Panel
        title="Wastage log"
        subtitle={`${inr(totalCost)} written off`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setLogging(true)}
            disabled={ingredients.length === 0}
            aria-label="Log wastage"
          >
            <AlertTriangle size={14} aria-hidden /> Log wastage
          </Button>
        }
      >
        {wastage.length === 0 ? (
          <EmptyState title="No wastage logged" description="Record spoilage or breakage to keep stock and food cost accurate." />
        ) : (
          <DataTable columns={columns} rows={wastage} rowKey={r => r.id} caption="Wastage entries" initialSortKey="when" />
        )}
      </Panel>

      <Modal
        open={logging}
        onClose={close}
        title="Log wastage"
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={close}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={!ingredientId || qty <= 0}>Log</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <SelectField label="Ingredient" value={ingredientId} onChange={setIngredientId} options={options} />
          <NumberField label={`Quantity${ingredientId ? ` (${byId.get(ingredientId)?.unit ?? ''})` : ''}`} value={qty} onChange={setQty} />
          <TextField label="Reason" value={reason} onChange={setReason} placeholder="Spoilage, breakage, over-prep…" />
        </div>
      </Modal>
    </>
  )
}
