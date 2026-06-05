import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldCheck, KeyRound } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { EmptyState } from '../components/EmptyState'
import { TextField, SelectField } from '../components/Field'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/api/client'
import {
  createStaff,
  deactivateStaff,
  listStaff,
  reactivateStaff,
  resetStaffPassword,
  type AdminStaff,
  type CreatableRole,
} from '../lib/staffApi'

const STAFF_KEY = ['admin-staff']

// Admins can create any role; managers can create every role except admin.
const ROLE_OPTIONS: Array<{ value: CreatableRole; label: string }> = [
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'host', label: 'Host' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

export function StaffManagement() {
  const { tokens: t } = useTheme()
  const auth = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const canManage = auth.permissions.includes('manage-staff')
  const isAdmin = auth.appRole === 'admin'
  const roleOptions = isAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter(r => r.value !== 'admin')

  const staff = useQuery({ queryKey: STAFF_KEY, queryFn: listStaff, enabled: canManage })
  const invalidate = () => qc.invalidateQueries({ queryKey: STAFF_KEY })

  const [addOpen, setAddOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [roleKey, setRoleKey] = useState<CreatableRole>('waiter')
  const [resetTarget, setResetTarget] = useState<AdminStaff | null>(null)
  const [resetPwd, setResetPwd] = useState('')

  const create = useMutation({
    mutationFn: () =>
      createStaff({ username: username.trim(), password, display_name: displayName.trim(), role_key: roleKey }),
    onSuccess: () => {
      toast.push('Staff account created')
      setAddOpen(false)
      setUsername(''); setDisplayName(''); setPassword(''); setRoleKey('waiter')
      invalidate()
    },
    onError: (e) => toast.push(errMsg(e, 'Could not create account'), 'warn'),
  })

  const toggleActive = useMutation({
    mutationFn: (s: AdminStaff) => (s.active ? deactivateStaff(s.id) : reactivateStaff(s.id).then(() => undefined)),
    onSuccess: () => { toast.push('Updated'); invalidate() },
    onError: (e) => toast.push(errMsg(e, 'Update failed'), 'warn'),
  })

  const reset = useMutation({
    mutationFn: () => resetStaffPassword(resetTarget!.id, resetPwd),
    onSuccess: () => { toast.push('Password reset'); setResetTarget(null); setResetPwd('') },
    onError: (e) => toast.push(errMsg(e, 'Reset failed'), 'warn'),
  })

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title="No access"
        description="You need the “manage staff” permission to view this page."
      />
    )
  }

  const rows = staff.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Staff accounts"
        subtitle="Create logins for waiters and managers. No self-registration — you provision every account."
        action={<Button size="sm" onClick={() => setAddOpen(true)}><span className="inline-flex items-center gap-1.5"><Plus size={15} /> Add staff</span></Button>}
      >
        {staff.isLoading ? (
          <p className="text-[13px] py-6" style={{ color: t.descColor, fontFamily: t.descFont }}>Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No staff yet" description="Add your first waiter or manager." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ fontFamily: t.descFont, color: t.ink }}>
              <thead>
                <tr style={{ color: t.descColor }} className="text-left">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Username</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${t.ruleColor}` }}>
                    <td className="py-2.5 pr-3">{s.name}</td>
                    <td className="py-2.5 pr-3">{s.username ?? '—'}</td>
                    <td className="py-2.5 pr-3 capitalize">{s.role}</td>
                    <td className="py-2.5 pr-3">{s.active ? 'Active' : 'Suspended'}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="subtle" onClick={() => setResetTarget(s)}>
                          <span className="inline-flex items-center gap-1"><KeyRound size={13} /> Reset</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={s.active ? 'danger' : 'primary'}
                          onClick={() => toggleActive.mutate(s)}
                        >
                          {s.active ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add staff member"
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={create.isPending || !username.trim() || !password} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Username" value={username} onChange={setUsername} placeholder="e.g. ravi.waiter" />
          <TextField label="Display name" value={displayName} onChange={setDisplayName} placeholder="Ravi" />
          <TextField label="Temporary password" value={password} onChange={setPassword} type="text" hint="They can request a change later." />
          <SelectField label="Role" value={roleKey} onChange={(v) => setRoleKey(v as CreatableRole)} options={roleOptions} />
        </div>
      </Modal>

      <Modal
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        title={`Reset password${resetTarget ? ` — ${resetTarget.name}` : ''}`}
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button size="sm" disabled={reset.isPending || !resetPwd} onClick={() => reset.mutate()}>
              {reset.isPending ? 'Saving…' : 'Reset password'}
            </Button>
          </>
        }
      >
        <TextField label="New password" value={resetPwd} onChange={setResetPwd} type="text" />
      </Modal>
    </div>
  )
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.body?.detail ?? e.message) : fallback
}
