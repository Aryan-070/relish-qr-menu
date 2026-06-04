import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, sectionTitleStyle, bodyStyle, headingStyle, isHard } from '../lib/skin'
import { Button } from '../components/Button'
import { formatMoney } from '../../lib/money'
import { isStaffAuthed, staffLogout } from '../../lib/api/auth'
import { StaffLogin } from '../../components/StaffLogin'
import {
  createItem,
  deleteItem,
  listCategories,
  listItems,
  patchItem,
  updateItem,
  type AdminMenuItem,
  type MenuItemDraft,
} from '../lib/menuApi'

const ITEMS_KEY = ['admin-menu-items']
const CATS_KEY = ['admin-menu-categories']

const emptyDraft = (categoryId: string): MenuItemDraft => ({
  name: '',
  price: 0,
  categoryId,
  description: '',
  spiceLevel: 0,
  isJain: false,
  available: true,
  soldOut: false,
})

/**
 * The live Menu editor — the first console view on the Django API (React Query
 * against /api/menu/). Self-contained: it gates on a Django staff login and
 * does not touch the localStorage useOpsStore. The remaining console views
 * follow this same repo→query→DRF pattern.
 */
export function MenuManagerLive() {
  const [authed, setAuthed] = useState(isStaffAuthed())

  if (!authed) {
    return (
      <StaffLogin
        onSuccess={() => setAuthed(true)}
        title="Console sign-in"
        subtitle="Sign in to edit the live menu."
      />
    )
  }
  return <MenuEditor onSignOut={() => { staffLogout(); setAuthed(false) }} />
}

function MenuEditor({ onSignOut }: { onSignOut: () => void }) {
  const { tokens: t } = useTheme()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<AdminMenuItem | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminMenuItem | null>(null)
  const radius = isHard(t) ? 0 : 999

  const categories = useQuery({ queryKey: CATS_KEY, queryFn: listCategories })
  const items = useQuery({ queryKey: ITEMS_KEY, queryFn: listItems })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY })

  const catName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories.data ?? []) m.set(c.id, c.name)
    return m
  }, [categories.data])

  const togglePatch = useMutation({
    mutationFn: ({ item, patch }: { item: AdminMenuItem; patch: { available?: boolean; sold_out?: boolean } }) =>
      patchItem(item.id, item.version, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => deleteItem(id), onSuccess: () => { invalidate(); setDeleteTarget(null) } })

  return (
    <div className="flex flex-col h-full" style={{ background: t.bg }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ ...bodyStyle(t), color: t.descColor }}>
            Live menu · Django
          </p>
          <h1 className="text-[22px]" style={headingStyle(t)}>
            {items.data?.length ?? 0} items
          </h1>
        </div>
        <Button variant="primary" size="md" onClick={() => setEditing('new')} aria-label="Add item">
          <Plus size={16} /> Add item
        </Button>
        <button onClick={onSignOut} className="text-[12px] px-3 py-2" style={{ ...bodyStyle(t), color: t.descColor, border: `1px solid ${t.ruleColor}`, borderRadius: radius }}>
          Sign out
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {items.isLoading ? (
          <p className="text-[13px] py-10 text-center" style={bodyStyle(t)}>Loading the live menu…</p>
        ) : items.isError ? (
          <p className="text-[13px] py-10 text-center" style={{ color: '#c0392b' }}>
            Couldn’t load the menu. Your session may have expired — sign out and back in.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(items.data ?? []).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3" style={panelStyle(t)}>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate" style={{ ...sectionTitleStyle(t), color: t.ink, opacity: item.available ? 1 : 0.5 }}>
                    {item.name}
                    {item.soldOut && <span className="ml-2 text-[10px] uppercase" style={{ color: '#c0392b' }}>sold out</span>}
                  </p>
                  <p className="text-[11px]" style={{ ...bodyStyle(t), color: t.descColor }}>
                    {catName.get(item.categoryId) ?? '—'} ·{' '}
                    <span style={{ fontFamily: t.priceFont, color: t.priceColor }}>{formatMoney(item.price)}</span>
                  </p>
                </div>
                <button
                  onClick={() => togglePatch.mutate({ item, patch: { available: !item.available } })}
                  className="text-[11px] px-2.5 py-1.5"
                  style={{ ...bodyStyle(t), border: `1px solid ${t.ruleColor}`, color: item.available ? t.accent : t.descColor, borderRadius: radius }}
                >
                  {item.available ? 'Visible' : 'Hidden'}
                </button>
                <button onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} className="w-8 h-8 flex items-center justify-center" style={{ color: t.accent }}>
                  <Pencil size={16} />
                </button>
                <button onClick={() => setDeleteTarget(item)} aria-label={`Delete ${item.name}`} className="w-8 h-8 flex items-center justify-center" style={{ color: t.inkSoft }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ItemFormModal
          item={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete “${deleteTarget.name}”?`}
          confirmLabel={remove.isPending ? 'Deleting…' : 'Delete'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove.mutate(deleteTarget.id)}
        />
      )}
    </div>
  )
}

function ItemFormModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: AdminMenuItem | null
  categories: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const { tokens: t } = useTheme()
  const [draft, setDraft] = useState<MenuItemDraft>(
    item
      ? { name: item.name, price: item.price, categoryId: item.categoryId, description: item.description, spiceLevel: item.spiceLevel, isJain: item.isJain, available: item.available, soldOut: item.soldOut }
      : emptyDraft(categories[0]?.id ?? ''),
  )
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof MenuItemDraft>(k: K, v: MenuItemDraft[K]) => setDraft(d => ({ ...d, [k]: v }))

  const save = useMutation({
    mutationFn: () => (item ? updateItem(item.id, item.version, draft) : createItem(draft)),
    onSuccess: onSaved,
    onError: () => setError('Save failed — check the fields (a stale edit needs a reload).'),
  })

  const inputStyle = { ...bodyStyle(t), background: '#fff', border: `1px solid ${t.ruleColor}`, borderRadius: isHard(t) ? 0 : 10, color: t.ink }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
        <h2 className="flex-1 text-[18px]" style={headingStyle(t)}>{item ? 'Edit item' : 'New item'}</h2>
        <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center" style={{ background: `${t.accent}14`, color: t.accent, borderRadius: isHard(t) ? 0 : 999 }}>
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        <Field label="Name">
          <input value={draft.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2.5 text-[14px]" style={inputStyle} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)">
            <input type="number" min={0} value={draft.price} onChange={e => set('price', Number(e.target.value))} className="w-full px-3 py-2.5 text-[14px]" style={inputStyle} />
          </Field>
          <Field label="Category">
            <select value={draft.categoryId} onChange={e => set('categoryId', e.target.value)} className="w-full px-3 py-2.5 text-[14px]" style={inputStyle}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea value={draft.description} onChange={e => set('description', e.target.value)} rows={2} className="w-full px-3 py-2.5 text-[14px]" style={inputStyle} />
        </Field>
        <div className="flex flex-wrap gap-4 text-[13px]" style={bodyStyle(t)}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.available} onChange={e => set('available', e.target.checked)} /> Visible</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.soldOut} onChange={e => set('soldOut', e.target.checked)} /> Sold out</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isJain} onChange={e => set('isJain', e.target.checked)} /> Jain</label>
        </div>
        {error && <p className="text-[12px]" style={{ color: '#c0392b' }}>{error}</p>}
      </div>
      <div className="px-5 py-4 flex items-center justify-end gap-3" style={{ borderTop: `1px solid ${t.ruleColor}` }}>
        <Button variant="ghost" size="md" onClick={onClose} aria-label="Cancel">Cancel</Button>
        <Button
          variant="primary" size="md"
          disabled={save.isPending || draft.name.trim().length === 0 || !draft.categoryId}
          onClick={() => { setError(null); save.mutate() }}
          aria-label="Save item"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Overlay>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { tokens: t } = useTheme()
  return (
    <label className="block">
      <span className="block text-[11px] mb-1" style={bodyStyle(t)}>{label}</span>
      {children}
    </label>
  )
}

function ConfirmModal({ title, confirmLabel, onCancel, onConfirm }: { title: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const { tokens: t } = useTheme()
  return (
    <Overlay onClose={onCancel}>
      <div className="p-5">
        <h2 className="text-[17px] mb-4" style={headingStyle(t)}>{title}</h2>
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="md" onClick={onCancel} aria-label="Cancel">Cancel</Button>
          <Button variant="danger" size="md" onClick={onConfirm} aria-label="Confirm delete">{confirmLabel}</Button>
        </div>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { tokens: t } = useTheme()
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(26,26,26,0.45)' }} onClick={onClose}>
      <div
        className="w-full max-w-md flex flex-col"
        style={{ background: t.bg, borderRadius: isHard(t) ? 0 : 16, maxHeight: '88vh', boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
