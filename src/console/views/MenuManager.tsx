import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Image as ImageIcon, Plus, Search, Video } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore, newMenuItem } from '../store/useOpsStore'
import { useToast } from '../components/Toast'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Drawer } from '../components/Drawer'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SegmentedControl } from '../components/SegmentedControl'
import { ToggleField } from '../components/Field'
import { EmptyState } from '../components/EmptyState'
import { fadeUp, stagger } from '../../animations/variants'
import { controlRadius, panelStyle } from '../lib/skin'
import { cn, inr } from '../lib/format'
import { LqipImage } from '../../components/atoms/LqipImage'
import { categories, getCategoryById } from '../../data/menu'
import { MenuItemForm } from './manager/MenuItemForm'
import type { EditableMenuItem } from '../lib/types'

type CategoryFilter = 'all' | string

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...categories.map(c => ({ value: c.id, label: c.name })),
]

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'create'; item: EditableMenuItem }
  | { mode: 'edit'; item: EditableMenuItem }

export function MenuManager() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<EditableMenuItem | null>(null)

  // The form registers its validated submit handler here; the Drawer footer calls it.
  const submitRef = useRef<(() => void) | null>(null)
  const registerSubmit = useCallback((fn: () => void) => {
    submitRef.current = fn
  }, [])

  const menu = ops.state.menu

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menu.filter(item => {
      if (category !== 'all' && item.categoryId !== category) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [menu, query, category])

  const openCreate = () => {
    const seedCategory = category === 'all' ? 'beverages' : category
    setDrawer({ mode: 'create', item: newMenuItem(seedCategory) })
  }

  const openEdit = (item: EditableMenuItem) => setDrawer({ mode: 'edit', item })

  const closeDrawer = () => {
    submitRef.current = null
    setDrawer({ mode: 'closed' })
  }

  const handleCommit = (next: EditableMenuItem) => {
    if (drawer.mode === 'create') {
      ops.menuCreate(next)
      push(`${next.name} added to menu`, 'success')
    } else if (drawer.mode === 'edit') {
      const { id, ...patch } = next
      ops.menuUpdate(id, patch)
      push(`${next.name} updated`, 'success')
    }
    closeDrawer()
  }

  const handleToggleAvailable = (item: EditableMenuItem) => {
    ops.menuToggleAvailable(item.id)
    push(item.available ? `${item.name} hidden` : `${item.name} available`, 'info')
  }

  const handleToggleSoldOut = (item: EditableMenuItem) => {
    ops.menuToggleSoldOut(item.id)
    push(item.soldOut ? `${item.name} back in stock` : `${item.name} marked sold out`, 'info')
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    ops.menuDelete(deleteTarget.id)
    push(`${deleteTarget.name} deleted`, 'warn')
    setDeleteTarget(null)
  }

  const drawerOpen = drawer.mode !== 'closed'

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            size={15}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: t.descColor }}
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items by name…"
            aria-label="Search menu items"
            className="w-full pl-9 pr-3 py-2.5 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-maroon"
            style={{
              borderRadius: 10,
              border: `1px solid ${t.ruleColor}`,
              background: '#FFFFFF',
              color: t.ink,
              fontFamily: t.descFont,
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="overflow-x-auto">
            <SegmentedControl
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              ariaLabel="Filter menu by category"
              size="sm"
            />
          </div>
          <Button variant="primary" size="md" onClick={openCreate} aria-label="Add menu item">
            <Plus size={15} aria-hidden /> Add item
          </Button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            title="No items found"
            description={
              query
                ? `No items match “${query}”.`
                : 'No items in this category yet — add one to get started.'
            }
            action={
              <Button variant="primary" size="sm" onClick={openCreate} aria-label="Add menu item">
                <Plus size={14} aria-hidden /> Add item
              </Button>
            }
          />
        </Panel>
      ) : (
        <motion.div
          key={category + query}
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2.5"
        >
          {filtered.map(item => (
            <MenuRow
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleAvailable={handleToggleAvailable}
              onToggleSoldOut={handleToggleSoldOut}
            />
          ))}
        </motion.div>
      )}

      {/* Create / Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={drawer.mode === 'edit' ? 'Edit item' : 'New menu item'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => submitRef.current?.()}>
              Save
            </Button>
          </>
        }
      >
        {drawer.mode !== 'closed' && (
          <MenuItemForm
            item={drawer.item}
            mode={drawer.mode}
            onCommit={handleCommit}
            registerSubmit={registerSubmit}
          />
        )}
      </Drawer>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete item?'}
        message="This permanently removes the item from the menu. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

interface MenuRowProps {
  item: EditableMenuItem
  onEdit: (item: EditableMenuItem) => void
  onDelete: (item: EditableMenuItem) => void
  onToggleAvailable: (item: EditableMenuItem) => void
  onToggleSoldOut: (item: EditableMenuItem) => void
}

function MenuRow({ item, onEdit, onDelete, onToggleAvailable, onToggleSoldOut }: MenuRowProps) {
  const { tokens: t } = useTheme()
  const categoryName = getCategoryById(item.categoryId)?.name ?? item.categoryId
  const thumbRadius = controlRadius(t)

  return (
    <motion.div
      variants={fadeUp}
      style={panelStyle(t)}
      className={cn(
        'p-3.5 flex flex-col lg:flex-row lg:items-center gap-3',
        !item.available && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Thumbnail */}
        {item.imageUrl ? (
          <LqipImage
            src={item.imageUrl}
            alt={`${item.name || 'Menu item'} photo`}
            wrapperClassName="shrink-0"
            wrapperStyle={{ width: 56, height: 56, borderRadius: thumbRadius }}
            imgClassName="w-full h-full object-cover"
          />
        ) : (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: thumbRadius,
              border: `1px solid ${t.ruleColor}`,
              color: t.descColor,
              background: 'rgba(0,0,0,0.02)',
            }}
            aria-hidden
          >
            <ImageIcon size={18} />
          </div>
        )}

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className="text-[15px] leading-tight"
            style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 600 }}
          >
            {item.name || 'Untitled item'}
          </h3>
          {item.chefsSpecial && <Pill label="Chef's special" tone="gold" />}
          {item.isJain && <Pill label="Jain" tone="olive" />}
          {item.soldOut && <Pill label="Sold out" tone="maroon" />}
          {!item.available && <Pill label="Unavailable" tone="muted" />}
          {item.badges.map(badge => (
            <Pill key={badge} label={badge} tone="muted" />
          ))}
          {item.videoUrl && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
              style={{
                color: PILL_TONES.olive.fg,
                background: PILL_TONES.olive.tint,
                border: `1px solid ${PILL_TONES.olive.ring}`,
                borderRadius: 999,
                fontFamily: t.descFont,
              }}
            >
              <Video size={10} aria-hidden /> Video
            </span>
          )}
        </div>
        <p
          className="text-[12px] mt-0.5"
          style={{ fontFamily: t.descFont, color: t.descColor }}
        >
          {categoryName}
        </p>
      </div>
      </div>

      {/* Price */}
      <span
        className="text-[15px] tabular-nums shrink-0"
        style={{ fontFamily: t.priceFont, color: t.ink, fontWeight: 600 }}
      >
        {inr(item.price)}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap lg:shrink-0">
        <div className="min-w-[120px]">
          <ToggleField
            label="Available"
            checked={item.available}
            onChange={() => onToggleAvailable(item)}
          />
        </div>
        <Button
          variant={item.soldOut ? 'gold' : 'subtle'}
          size="sm"
          onClick={() => onToggleSoldOut(item)}
          aria-label={item.soldOut ? `Mark ${item.name} in stock` : `Mark ${item.name} sold out`}
        >
          {item.soldOut ? 'In stock' : 'Sold out'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.name}`}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.name}`}
        >
          Delete
        </Button>
      </div>
    </motion.div>
  )
}

type PillTone = 'gold' | 'olive' | 'maroon' | 'muted'

const PILL_TONES: Record<PillTone, { fg: string; tint: string; ring: string }> = {
  gold: { fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  olive: { fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
  maroon: { fg: '#8B1024', tint: 'rgba(139,16,36,0.10)', ring: 'rgba(139,16,36,0.40)' },
  muted: { fg: '#4a3f3a', tint: 'rgba(74,63,58,0.10)', ring: 'rgba(74,63,58,0.32)' },
}

function Pill({ label, tone }: { label: string; tone: PillTone }) {
  const { tokens: t } = useTheme()
  const c = PILL_TONES[tone]
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
      style={{
        color: c.fg,
        background: c.tint,
        border: `1px solid ${c.ring}`,
        borderRadius: 999,
        fontFamily: t.descFont,
      }}
    >
      {label}
    </span>
  )
}
