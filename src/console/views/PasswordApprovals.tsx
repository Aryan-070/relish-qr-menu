import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/api/client'
import {
  approvePasswordRequest,
  listPasswordRequests,
  rejectPasswordRequest,
} from '../lib/passwordRequestsApi'

const PWD_KEY = ['password-requests']

export function PasswordApprovals() {
  const { tokens: t } = useTheme()
  const auth = useAuth()
  const toast = useToast()
  const qc = useQueryClient()

  const canManage = auth.permissions.includes('manage-staff')
  const requests = useQuery({ queryKey: PWD_KEY, queryFn: listPasswordRequests, enabled: canManage })
  const invalidate = () => qc.invalidateQueries({ queryKey: PWD_KEY })

  const approve = useMutation({
    mutationFn: (id: string) => approvePasswordRequest(id),
    onSuccess: () => { toast.push('Password change approved'); invalidate() },
    onError: (e) => toast.push(errMsg(e, 'Approve failed'), 'warn'),
  })
  const reject = useMutation({
    mutationFn: (id: string) => rejectPasswordRequest(id),
    onSuccess: () => { toast.push('Request rejected'); invalidate() },
    onError: (e) => toast.push(errMsg(e, 'Reject failed'), 'warn'),
  })

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title="No access"
        description="You need the “manage staff” permission to review password requests."
      />
    )
  }

  const rows = (requests.data ?? []).filter(r => r.status === 'pending')

  return (
    <Panel title="Password change requests" subtitle="Approve or reject staff-requested password changes.">
      {requests.isLoading ? (
        <p className="text-[13px] py-6" style={{ color: t.descColor, fontFamily: t.descFont }}>Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing pending" description="There are no password-change requests to review." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ fontFamily: t.descFont, color: t.ink }}>
            <thead>
              <tr style={{ color: t.descColor }} className="text-left">
                <th className="py-2 pr-3 font-medium">Staff</th>
                <th className="py-2 pr-3 font-medium">Username</th>
                <th className="py-2 pr-3 font-medium">Requested</th>
                <th className="py-2 pr-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${t.ruleColor}` }}>
                  <td className="py-2.5 pr-3">{r.requester_name}</td>
                  <td className="py-2.5 pr-3">{r.requester_username ?? '—'}</td>
                  <td className="py-2.5 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="subtle" onClick={() => reject.mutate(r.id)}>Reject</Button>
                      <Button size="sm" onClick={() => approve.mutate(r.id)}>Approve</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.body?.detail ?? e.message) : fallback
}
