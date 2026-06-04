import { useState, type FormEvent } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { bodyStyle, headingStyle, panelStyle, isHard } from '../console/lib/skin'
import { Button } from '../console/components/Button'
import { staffLogin } from '../lib/api/auth'

interface StaffLoginProps {
  onSuccess: () => void
  title?: string
  subtitle?: string
  /** Prefilled for the seeded demo; clear in production. */
  defaultEmail?: string
  defaultPassword?: string
}

/**
 * Shared staff sign-in: exchanges email/password for a Django JWT (stored for
 * the api client). Used by both the floor cockpit and the console's
 * Django-backed views. Themed via the active theme tokens.
 */
export function StaffLogin({
  onSuccess,
  title = 'Staff sign-in',
  subtitle = 'Sign in to manage live data.',
  defaultEmail = 'staff@tabletheory.test',
  defaultPassword = 'TableTheory#2026',
}: StaffLoginProps) {
  const { tokens: t } = useTheme()
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState(defaultPassword)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await staffLogin(email, password)
      onSuccess()
    } catch {
      setError('Sign-in failed — check the email and password.')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = {
    ...bodyStyle(t),
    background: '#fff',
    border: `1px solid ${t.ruleColor}`,
    borderRadius: isHard(t) ? 0 : 12,
    color: t.ink,
  }

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-10" style={{ background: t.bg }}>
      <form onSubmit={submit} className="w-full max-w-sm p-6" style={panelStyle(t)}>
        <h2 className="text-[22px] mb-1" style={headingStyle(t)}>{title}</h2>
        <p className="text-[12px] mb-4" style={{ ...bodyStyle(t), color: t.descColor }}>{subtitle}</p>
        <label className="block text-[11px] mb-1" style={bodyStyle(t)}>Email</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 mb-3 text-[14px]" style={inputStyle} autoComplete="username"
        />
        <label className="block text-[11px] mb-1" style={bodyStyle(t)}>Password</label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 mb-4 text-[14px]" style={inputStyle} autoComplete="current-password"
        />
        {error && <p className="text-[12px] mb-3" style={{ color: '#c0392b' }}>{error}</p>}
        <Button variant="primary" size="md" type="submit" disabled={busy} aria-label="Sign in">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
