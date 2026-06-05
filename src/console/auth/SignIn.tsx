import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'
import { Button } from '../components/Button'
import { useAuth } from './AuthContext'

/** Console sign-in. Accounts are provisioned by an admin/manager — there is no
 *  self-registration. Login accepts a username or recovery email. */
export function SignIn() {
  const { tokens: t } = useTheme()
  const auth = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await auth.signIn(identifier.trim(), password)
    setBusy(false)
    if (error) setError(error)
  }

  const inputStyle = {
    border: `1px solid ${t.ruleColor}`,
    borderRadius: 8,
    padding: '9px 11px',
    fontFamily: t.descFont,
    color: t.ink,
    background: '#fff',
    outlineColor: t.accent,
  } as const

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FBF7F0' }}>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ ...panelStyle(t), maxWidth: 380 }}
        className="w-full p-7 flex flex-col gap-4"
      >
        <div>
          <h1 className="text-2xl" style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}>
            Relish Console
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Sign in to manage your restaurant.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Username or email
          <input
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && <p className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>{error}</p>}

        <Button type="submit" fullWidth disabled={busy}>
          {busy ? 'Please wait…' : 'Sign in'}
        </Button>

        <p className="text-[11px] self-center text-center" style={{ color: t.descColor, fontFamily: t.descFont }}>
          No account? Ask your manager or admin to create one.
        </p>
      </motion.form>
    </div>
  )
}
