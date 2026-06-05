import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'

export interface DetailsPayload {
  phone: string
  name: string
  birthday: { day: number; month: number } | null
}

interface SaveDetailsSheetProps {
  open: boolean
  /** Required mode: the host must save name + mobile before ordering. */
  required?: boolean
  onClose: () => void
  onSubmit: (payload: DetailsPayload) => Promise<void>
}

/** Bottom sheet to capture name + mobile + birthday (DD/MM) → links a CRM
 *  customer for the table. Birthday is optional; name + mobile are required. */
export function SaveDetailsSheet({ open, required = false, onClose, onSubmit }: SaveDetailsSheetProps) {
  const { tokens: t } = useTheme()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && phone.trim().length >= 6 && !busy

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const d = parseInt(day, 10)
    const m = parseInt(month, 10)
    const birthday = d >= 1 && d <= 31 && m >= 1 && m <= 12 ? { day: d, month: m } : null
    try {
      await onSubmit({ phone: phone.trim(), name: name.trim(), birthday })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.')
      setBusy(false)
      return
    }
    setBusy(false)
  }

  const inputStyle = {
    border: '1px solid rgba(217,160,58,0.35)',
    borderRadius: 10,
    padding: '10px 12px',
    fontFamily: t.descFont,
    color: t.ink,
    background: '#fff',
    outlineColor: t.accent,
    width: '100%',
  } as const

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="details-backdrop"
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(42,30,30,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
          />
          <motion.form
            key="details-panel"
            onSubmit={submit}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] z-[61] rounded-t-3xl p-6 flex flex-col gap-3"
            style={{ background: 'var(--paper)', boxShadow: 'var(--shadow-sheet)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-playfair font-bold text-[18px]" style={{ color: 'var(--maroon)' }}>
                  Your details
                </h3>
                <p className="font-inter text-[12px] mt-0.5" style={{ color: 'var(--mute)' }}>
                  {required
                    ? 'Add your name & mobile to place the table’s order.'
                    : 'Save your details for the bill, rewards & birthday treats.'}
                </p>
              </div>
              {!required && (
                <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,16,36,0.08)' }}>
                  <X size={15} style={{ color: 'var(--maroon)' }} />
                </button>
              )}
            </div>

            <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--mute)', fontFamily: t.descFont }}>
              Name
              <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--mute)', fontFamily: t.descFont }}>
              Mobile number
              <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91…" style={inputStyle} />
            </label>
            <div className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--mute)', fontFamily: t.descFont }}>
              Birthday <span style={{ opacity: 0.7 }}>(optional)</span>
              <div className="flex gap-2">
                <input value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="DD" style={{ ...inputStyle, width: 80, textAlign: 'center' }} />
                <input value={month} onChange={e => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="MM" style={{ ...inputStyle, width: 80, textAlign: 'center' }} />
              </div>
            </div>

            {error && <p className="text-[12px]" style={{ color: '#b3141b', fontFamily: t.descFont }}>{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-full font-inter font-semibold text-[13.5px] mt-1"
              style={{
                background: canSubmit ? 'linear-gradient(135deg, #A52030, #7A0E1E)' : 'rgba(42,30,30,0.18)',
                color: canSubmit ? '#FFF8EA' : 'var(--ink-soft)',
                minHeight: 44,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {busy ? 'Saving…' : 'Save details'}
            </button>
          </motion.form>
        </>
      )}
    </AnimatePresence>
  )
}
