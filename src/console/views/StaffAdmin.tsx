import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { useToast } from '../components/Toast'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { DataTable, type Column } from '../components/DataTable'
import { SegmentedControl } from '../components/SegmentedControl'
import { TextField, SelectField, ToggleField } from '../components/Field'
import { fadeUp, stagger } from '../../animations/variants'
import { isHard } from '../lib/skin'
import type { StatusStyle } from '../lib/statusColors'
import type { Permission, Role, Staff } from '../lib/types'

// ── Static metadata ──────────────────────────────────────────────────────────

type RoleFilter = 'all' | Role

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'manager', label: 'Managers' },
  { value: 'waiter', label: 'Waiters' },
]

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'waiter', label: 'Waiter' },
]

const SHIFT_OPTIONS: Array<{ value: Staff['shift']; label: string }> = [
  { value: 'AM', label: 'AM (opening)' },
  { value: 'PM', label: 'PM (closing)' },
]

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  waiter: 'Waiter',
}

/** All permissions in display order, with a human label + short description. */
const PERMISSION_META: Array<{ value: Permission; label: string; hint: string }> = [
  { value: 'void', label: 'Void orders', hint: 'Cancel a placed ticket' },
  { value: 'comp', label: 'Comp orders', hint: 'On-the-house' },
  { value: 'discount', label: 'Apply discounts', hint: 'Manager comps' },
  { value: 'refund', label: 'Issue refunds', hint: 'Reverse a payment' },
  { value: 'edit-menu', label: 'Edit menu', hint: 'Items, prices, photos' },
  { value: 'manage-stock', label: 'Manage stock', hint: 'Inventory & 86' },
  { value: 'manage-staff', label: 'Manage staff', hint: 'Roster & access' },
  { value: 'view-reports', label: 'View reports', hint: 'Analytics & sales' },
]

// Reuse the StatusStyle shape so the role pill reads like every other Badge.
const ROLE_STATUS: Record<Role, StatusStyle> = {
  admin: { label: 'Admin', fg: '#8B1024', tint: 'rgba(139,16,36,0.10)', ring: 'rgba(139,16,36,0.40)' },
  manager: { label: 'Manager', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  waiter: { label: 'Waiter', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
}

const ACTIVE_STATUS: StatusStyle = {
  label: 'Active',
  fg: '#3d6130',
  tint: 'rgba(79,122,60,0.12)',
  ring: 'rgba(79,122,60,0.40)',
}
const INACTIVE_STATUS: StatusStyle = {
  label: 'Inactive',
  fg: '#4a3f3a',
  tint: 'rgba(74,63,58,0.10)',
  ring: 'rgba(74,63,58,0.32)',
}

/** Deterministic hue (0–360) from a seed string for the generated avatar. */
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

function makeStaffId(): string {
  return `S-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`
}

// ── KPI tile (matches LoyaltyCrm) ────────────────────────────────────────────

interface KpiTileProps {
  label: string
  value: string
}

function KpiTile({ label, value }: KpiTileProps) {
  const { tokens: t } = useTheme()
  return (
    <motion.div variants={fadeUp}>
      <Panel className="flex flex-col gap-1.5">
        <span
          className="text-[11px] uppercase"
          style={{ color: t.descColor, fontFamily: t.descFont, letterSpacing: '0.06em' }}
        >
          {label}
        </span>
        <span
          className="text-[24px] leading-none tabular-nums"
          style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}
        >
          {value}
        </span>
      </Panel>
    </motion.div>
  )
}

// ── Editable staff draft (used by the add/edit modal) ────────────────────────

interface StaffDraft {
  id: string
  name: string
  role: Role
  shift: Staff['shift']
  email: string
  active: boolean
  permissions: Permission[]
}

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: StaffDraft }
  | { mode: 'edit'; original: Staff; draft: StaffDraft }

function draftFromStaff(s: Staff): StaffDraft {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    shift: s.shift,
    email: s.email ?? '',
    active: s.active,
    permissions: [...s.permissions],
  }
}

function emptyDraft(): StaffDraft {
  return {
    id: makeStaffId(),
    name: '',
    role: 'waiter',
    shift: 'AM',
    email: '',
    active: true,
    permissions: ['void'],
  }
}

// ── Permission matrix (shared checkbox grid) ─────────────────────────────────

interface PermissionMatrixProps {
  permissions: Permission[]
  onToggle: (permission: Permission) => void
}

function PermissionMatrix({ permissions, onToggle }: PermissionMatrixProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const granted = new Set(permissions)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {PERMISSION_META.map(p => {
        const on = granted.has(p.value)
        return (
          <label
            key={p.value}
            className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
            style={{
              border: `1px solid ${on ? t.accent : t.ruleColor}`,
              borderRadius: hard ? 0 : 10,
              background: on ? 'rgba(42,30,30,0.03)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onToggle(p.value)}
              aria-label={`${on ? 'Revoke' : 'Grant'} ${p.label}`}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
              style={{ accentColor: t.accent }}
            />
            <span className="min-w-0">
              <span
                className="block text-[13px] font-semibold"
                style={{ color: t.ink, fontFamily: t.descFont }}
              >
                {p.label}
              </span>
              <span
                className="block text-[11px]"
                style={{ color: t.descColor, fontFamily: t.descFont }}
              >
                {p.hint}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export function StaffAdmin() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()
  const { push } = useToast()
  const staff = ops.state.staff

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null)

  const kpis = useMemo(() => {
    let admins = 0
    let managers = 0
    let waiters = 0
    let active = 0
    for (const s of staff) {
      if (s.role === 'admin') admins += 1
      else if (s.role === 'manager') managers += 1
      else waiters += 1
      if (s.active) active += 1
    }
    return { total: staff.length, admins, managers, waiters, active }
  }, [staff])

  const visible = useMemo(() => {
    const filtered =
      roleFilter === 'all' ? staff : staff.filter(s => s.role === roleFilter)
    // Active first, then admins → managers → waiters, then name.
    const roleRank: Record<Role, number> = { admin: 0, manager: 1, waiter: 2 }
    return [...filtered].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      if (a.role !== b.role) return roleRank[a.role] - roleRank[b.role]
      return a.name.localeCompare(b.name)
    })
  }, [staff, roleFilter])

  const openCreate = () => setEditor({ mode: 'create', draft: emptyDraft() })
  const openEdit = (s: Staff) =>
    setEditor({ mode: 'edit', original: s, draft: draftFromStaff(s) })
  const closeEditor = () => setEditor({ mode: 'closed' })

  const patchDraft = (patch: Partial<StaffDraft>) => {
    setEditor(prev => {
      if (prev.mode === 'closed') return prev
      return { ...prev, draft: { ...prev.draft, ...patch } }
    })
  }

  const toggleDraftPermission = (permission: Permission) => {
    setEditor(prev => {
      if (prev.mode === 'closed') return prev
      const has = prev.draft.permissions.includes(permission)
      const permissions = has
        ? prev.draft.permissions.filter(p => p !== permission)
        : [...prev.draft.permissions, permission]
      return { ...prev, draft: { ...prev.draft, permissions } }
    })
  }

  const commitEditor = () => {
    if (editor.mode === 'closed') return
    const d = editor.draft
    const name = d.name.trim()
    if (!name) {
      push('Name is required', 'warn')
      return
    }
    const member: Staff = {
      id: d.id,
      name,
      role: d.role,
      shift: d.shift,
      hue: hueFor(d.id || name),
      permissions: d.permissions,
      active: d.active,
      email: d.email.trim() || undefined,
    }
    if (editor.mode === 'create') {
      ops.addStaff(member)
      push(`${name} added to the team`, 'success')
    } else {
      const { id, ...patch } = member
      ops.updateStaff(id, patch)
      push(`${name} updated`, 'success')
    }
    closeEditor()
  }

  // Inline matrix toggle on a saved row — persisted immediately via the store.
  const toggleRowPermission = (s: Staff, permission: Permission) => {
    const has = s.permissions.includes(permission)
    const next = has
      ? s.permissions.filter(p => p !== permission)
      : [...s.permissions, permission]
    ops.setStaffPermissions(s.id, next)
    push(
      `${has ? 'Revoked' : 'Granted'} “${permission}” · ${s.name}`,
      has ? 'warn' : 'success',
    )
  }

  const toggleActive = (s: Staff) => {
    ops.updateStaff(s.id, { active: !s.active })
    push(s.active ? `${s.name} deactivated` : `${s.name} reactivated`, 'info')
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    ops.removeStaff(deleteTarget.id)
    push(`${deleteTarget.name} removed`, 'warn')
    setDeleteTarget(null)
  }

  const columns: Column<Staff>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Member',
        sortValue: s => s.name.toLowerCase(),
        render: s => (
          <div className="flex items-center gap-2.5">
            <Avatar name={s.name} hue={s.hue} size={32} />
            <div className="min-w-0">
              <span
                className="block text-[13px] font-semibold truncate"
                style={{ color: t.ink, fontFamily: t.descFont }}
              >
                {s.name}
              </span>
              {s.email && (
                <span
                  className="block text-[11px] truncate"
                  style={{ color: t.descColor, fontFamily: t.descFont }}
                >
                  {s.email}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        sortValue: s => s.role,
        render: s => <Badge status={ROLE_STATUS[s.role]} label={ROLE_LABEL[s.role]} dot={false} />,
      },
      {
        key: 'shift',
        header: 'Shift',
        align: 'center',
        sortValue: s => s.shift,
        render: s => <span>{s.shift}</span>,
      },
      {
        key: 'permissions',
        header: 'Access',
        align: 'center',
        sortValue: s => s.permissions.length,
        render: s => (
          <span title={s.permissions.join(', ') || 'No permissions'}>
            {s.permissions.length} / {PERMISSION_META.length}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Status',
        align: 'center',
        sortValue: s => (s.active ? 1 : 0),
        render: s => (
          <button
            type="button"
            onClick={() => toggleActive(s)}
            className="cursor-pointer"
            aria-label={`${s.active ? 'Deactivate' : 'Reactivate'} ${s.name}`}
            title={s.active ? 'Click to deactivate' : 'Click to reactivate'}
          >
            <Badge status={s.active ? ACTIVE_STATUS : INACTIVE_STATUS} />
          </button>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: s => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => openEdit(s)}
              aria-label={`Edit ${s.name}`}
              title="Edit"
            >
              <Pencil size={13} aria-hidden /> Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(s)}
              aria-label={`Remove ${s.name}`}
              title="Remove"
            >
              <Trash2 size={13} aria-hidden />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-[24px] leading-none"
            style={{ fontFamily: t.headerFont, color: t.ink }}
          >
            Staff Admin
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Manage your team, roles and granular access
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} aria-label="Add staff member">
          <UserPlus size={15} aria-hidden /> Add staff
        </Button>
      </div>

      {/* KPI strip */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <KpiTile label="Team" value={String(kpis.total)} />
        <KpiTile label="Active" value={String(kpis.active)} />
        <KpiTile label="Admins" value={String(kpis.admins)} />
        <KpiTile label="Managers" value={String(kpis.managers)} />
        <KpiTile label="Waiters" value={String(kpis.waiters)} />
      </motion.div>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<RoleFilter>
          options={ROLE_FILTERS}
          value={roleFilter}
          onChange={setRoleFilter}
          ariaLabel="Filter staff by role"
          size="sm"
        />
        <span className="text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {visible.length} shown
        </span>
      </div>

      {/* Directory */}
      <Panel padded={false} className="px-2 sm:px-3 py-2">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={30} />}
            title="No staff found"
            description={
              roleFilter !== 'all'
                ? 'No team members match this role filter.'
                : 'Add your first team member to get started.'
            }
          />
        ) : (
          <DataTable<Staff>
            columns={columns}
            rows={visible}
            rowKey={s => s.id}
            caption="Staff directory"
            initialSortKey="name"
            initialSortDir="asc"
          />
        )}
      </Panel>

      {/* Permission matrix — saved instantly via setStaffPermissions */}
      <Panel
        title="Permission matrix"
        subtitle="Toggle a capability to grant or revoke it. Changes save instantly."
      >
        {staff.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={30} />}
            title="No staff to configure"
            description="Add a team member first, then assign their access here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">Permission matrix by staff member</caption>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.ruleColor}` }}>
                  <th
                    scope="col"
                    className="py-2 px-2 text-left text-[11px] uppercase tracking-wider font-semibold"
                    style={{ fontFamily: t.descFont, color: t.inkSoft }}
                  >
                    Member
                  </th>
                  {PERMISSION_META.map(p => (
                    <th
                      key={p.value}
                      scope="col"
                      className="py-2 px-2 text-center text-[10px] uppercase tracking-wide font-semibold"
                      style={{ fontFamily: t.descFont, color: t.inkSoft }}
                      title={p.hint}
                    >
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(s => {
                  const granted = new Set(s.permissions)
                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: `1px solid ${t.ruleColor}` }}
                      className="hover:bg-black/[0.02]"
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.name} hue={s.hue} size={28} />
                          <span
                            className="text-[13px] font-semibold whitespace-nowrap"
                            style={{ color: t.ink, fontFamily: t.descFont }}
                          >
                            {s.name}
                          </span>
                        </div>
                      </td>
                      {PERMISSION_META.map(p => {
                        const on = granted.has(p.value)
                        return (
                          <td key={p.value} className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleRowPermission(s, p.value)}
                              aria-label={`${on ? 'Revoke' : 'Grant'} ${p.label} for ${s.name}`}
                              className="h-4 w-4 cursor-pointer"
                              style={{ accentColor: t.accent }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add / Edit modal */}
      <Modal
        open={editor.mode !== 'closed'}
        onClose={closeEditor}
        width={560}
        title={editor.mode === 'edit' ? 'Edit staff member' : 'Add staff member'}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={closeEditor}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={commitEditor}>
              <Plus size={14} aria-hidden />
              {editor.mode === 'edit' ? 'Save changes' : 'Add member'}
            </Button>
          </>
        }
      >
        {editor.mode !== 'closed' && (
          <div className="flex flex-col gap-4">
            <TextField
              label="Name"
              value={editor.draft.name}
              onChange={v => patchDraft({ name: v })}
              placeholder="e.g. Aarav Mehta"
            />
            <TextField
              label="Email"
              value={editor.draft.email}
              onChange={v => patchDraft({ email: v })}
              placeholder="name@relish.in"
              hint="Optional — used for sign-in invites."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Role"
                value={editor.draft.role}
                onChange={v => patchDraft({ role: v as Role })}
                options={ROLE_OPTIONS}
              />
              <SelectField
                label="Shift"
                value={editor.draft.shift}
                onChange={v => patchDraft({ shift: v as Staff['shift'] })}
                options={SHIFT_OPTIONS}
              />
            </div>

            <ToggleField
              label="Active"
              description="Inactive members keep their record but cannot sign in."
              checked={editor.draft.active}
              onChange={v => patchDraft({ active: v })}
            />

            <div className="flex flex-col gap-2">
              <span
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ fontFamily: t.descFont, color: t.inkSoft }}
              >
                Permissions
              </span>
              <PermissionMatrix
                permissions={editor.draft.permissions}
                onToggle={toggleDraftPermission}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        width={400}
        title="Remove staff member?"
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              <Trash2 size={14} aria-hidden /> Remove
            </Button>
          </>
        }
      >
        <p className="text-[13px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          {deleteTarget
            ? `${deleteTarget.name} will be removed from the team. This cannot be undone in the demo.`
            : ''}
        </p>
      </Modal>
    </div>
  )
}
