import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { TextField } from '../components/Field'
import { useToast } from '../components/Toast'
import { ApiError } from '../../lib/api/client'
import { requestPasswordChange } from '../lib/passwordRequestsApi'

/** Waiter self-service: request a password change that an admin/manager approves. */
export function PasswordChangeRequestView() {
  const { tokens: t } = useTheme()
  const toast = useToast()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: () => requestPasswordChange(pwd),
    onSuccess: () => {
      toast.push('Request submitted — awaiting approval')
      setSubmitted(true)
      setPwd(''); setConfirm('')
    },
    onError: (e) =>
      toast.push(e instanceof ApiError ? (e.body?.detail ?? e.message) : 'Request failed', 'warn'),
  })

  const mismatch = confirm.length > 0 && pwd !== confirm
  const canSubmit = pwd.length > 0 && pwd === confirm && !mutation.isPending

  return (
    <Panel
      title="Request a password change"
      subtitle="Your manager or an admin must approve the change before it takes effect."
    >
      <div className="flex flex-col gap-3 max-w-[420px]">
        <TextField label="New password" value={pwd} onChange={(v) => { setPwd(v); setSubmitted(false) }} type="text" />
        <TextField label="Confirm new password" value={confirm} onChange={setConfirm} type="text" />
        {mismatch && (
          <p className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>Passwords don’t match.</p>
        )}
        {submitted && (
          <p className="text-[12px]" style={{ color: '#3d6130', fontFamily: t.descFont }}>
            Your request is pending approval.
          </p>
        )}
        <div>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
