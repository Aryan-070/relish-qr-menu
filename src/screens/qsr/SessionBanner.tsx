import { Loader2, Users, Wifi, WifiOff } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { bodyStyle, isHard } from '../../console/lib/skin'
import type { UseSessionResult } from '../../hooks/useSession'

interface SessionBannerProps {
  session: UseSessionResult
}

/**
 * A thin live strip shown when a QR session is active. It states, in plain
 * language, what's happening — joining, who's at the table, and whether *this*
 * device can order yet — so a guest who can't order never assumes the app is
 * broken (the council's "never a silent dead state" rule).
 */
export function SessionBanner({ session }: SessionBannerProps) {
  const { tokens: t } = useTheme()
  const radius = isHard(t) ? 0 : 999

  const message = describe(session)
  const connected = session.session !== null

  return (
    <div
      className="shrink-0 flex items-center gap-2.5 px-4 sm:px-6 py-2"
      style={{ background: `${t.accent}12`, borderBottom: `1px solid ${t.ruleColor}` }}
    >
      {session.joining ? (
        <Loader2 size={14} className="animate-spin shrink-0" style={{ color: t.accent }} />
      ) : connected ? (
        <Wifi size={14} className="shrink-0" style={{ color: t.accent }} />
      ) : (
        <WifiOff size={14} className="shrink-0" style={{ color: t.descColor }} />
      )}

      <p className="text-[12px] leading-snug flex-1 min-w-0" style={bodyStyle(t)}>
        {message}
      </p>

      {session.session && (
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5"
          style={{ background: '#fff', color: t.accent, borderRadius: radius, fontFamily: t.descFont }}
        >
          <Users size={11} /> {session.session.party_size}
        </span>
      )}
    </div>
  )
}

function describe(session: UseSessionResult): string {
  if (session.joinError) return `Couldn't join this table — ${session.joinError}`
  if (session.joining || !session.session) return 'Joining your table…'

  const mode = session.session.order_confirmation_mode
  if (session.canOrder) {
    if (session.isLeader) return "You're ordering for the table."
    if (mode === 'waiter_confirm') return 'Build your order — your server confirms it before the kitchen starts.'
    return 'You can place orders for the table.'
  }
  // Browse-only — explain why and what unlocks ordering.
  if (mode === 'leader') return 'Browsing the menu — ask your server to start your order.'
  return 'Browsing the menu.'
}
