import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle } from '../lib/skin'
import { Button } from '../components/Button'
import { useAuth } from './AuthContext'

/** Console sign-in / sign-up. Only rendered in Supabase mode without a session. */
export function SignIn() {
  const { tokens: t } = useTheme()
  const auth = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const fn = mode === 'in' ? auth.signIn : auth.signUp
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) setError(error)
    else if (mode === 'up') setNotice('Account created. Check your email to confirm, then sign in.')
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
            {mode === 'in' ? 'Sign in to manage your restaurant.' : 'Create your console account.'}
          </p>
        </div>

        <label className="flex flex-col gap-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && <p className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>{error}</p>}
        {notice && <p className="text-[12px]" style={{ color: '#3d6130', fontFamily: t.descFont }}>{notice}</p>}

        <Button type="submit" fullWidth disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError(null)
            setNotice(null)
          }}
          className="text-[12px] underline self-center cursor-pointer"
          style={{ color: t.accent, fontFamily: t.descFont }}
        >
          {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </motion.form>
    </div>
  )
}
