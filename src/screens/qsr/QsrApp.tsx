import { lazy, Suspense, useMemo, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useOrder } from '../../hooks/useOrder'
import { useSession, readSessionParamsFromUrl } from '../../hooks/useSession'
import { usePublicMenu } from '../../hooks/usePublicMenu'
import { queryClient } from '../../lib/queryClient'
import { useTheme } from '../../theme/ThemeContext'
import { SegmentedControl } from '../../console/components/SegmentedControl'
import { headingStyle, bodyStyle } from '../../console/lib/skin'
import { WaiterCopilot } from './WaiterCopilot'
import { GuestFastMenu } from './GuestFastMenu'
import { SessionBanner } from './SessionBanner'

// Three.js landing heroes are lazy-loaded so the WebGL/R3F bundle only ships
// for the /qsr surface and code-splits per variant.
const QsrLandingEnvelope = lazy(() => import('./landings/QsrLandingEnvelope').then(m => ({ default: m.QsrLandingEnvelope })))
const QsrLandingParticles = lazy(() => import('./landings/QsrLandingParticles').then(m => ({ default: m.QsrLandingParticles })))
const QsrLandingBowl = lazy(() => import('./landings/QsrLandingBowl').then(m => ({ default: m.QsrLandingBowl })))

type QsrView = 'waiter' | 'guest'
type QsrLandingVariant = 'envelope' | 'particles' | 'bowl'

const VIEW_OPTIONS = [
  { value: 'waiter' as const, label: 'Staff' },
  { value: 'guest' as const, label: 'Guest' },
]

const VIEW_TITLE: Record<QsrView, string> = {
  waiter: 'Waiter Copilot',
  guest: 'Guest Quick Menu',
}

const BLURB: Record<QsrView, string> = {
  waiter:
    'On the waiter’s own phone — no kiosk, no tablet. Tap a table, the menu collapses to what fits, read the whisper line aloud, fire to the kitchen.',
  guest:
    'A faster guest menu — combos pinned, one-tap add, an upsell whisper above the cart. Shared by the waiter to a big table via an opt-in link, never a forced scan.',
}

const LANDING_VARIANTS: Array<{ id: QsrLandingVariant; label: string }> = [
  { id: 'envelope', label: 'Envelope' },
  { id: 'particles', label: 'Particles' },
  { id: 'bowl', label: 'Bowl' },
]

/**
 * QSR surface for The Table Theory, mounted at `/qsr`. Wraps the inner surface
 * in a React Query provider so the dining-session hook can poll the backend.
 */
export function QsrApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <QsrAppInner />
    </QueryClientProvider>
  )
}

/**
 * A guest first lands on one of three animated 3D heroes (switchable, for the
 * pitch), then enters the menu — a "Staff / Guest" toggle flips between the
 * Waiter Copilot (the no-hardware cockpit) and the Guest Quick Menu (a faster
 * storefront), sharing one cart. When the URL carries a `?r=&t=` QR, a real
 * dining session is joined and its live state drives ordering authority.
 * Forced into the `table-theory` brand theme by App.tsx.
 */
function QsrAppInner() {
  // Own cart key so the /qsr prototype never mixes with the consumer app's cart.
  const order = useOrder('relish.qsr.cart.v1')
  // Joins/polls the table session when the URL has a QR (r + t); otherwise inert.
  const session = useSession()
  // Backend menu (for resolving cart lines to real MenuItem UUIDs at order time).
  const sessionParams = useMemo(() => readSessionParamsFromUrl(), [])
  const menu = usePublicMenu(sessionParams?.restaurantId)
  const { tokens: t } = useTheme()
  const [view, setView] = useState<QsrView>('guest')
  const [entered, setEntered] = useState(false)
  const [landingVariant, setLandingVariant] = useState<QsrLandingVariant>('envelope')

  const enter = () => { setView('guest'); setEntered(true) }

  // ── Landing screen (pre-entry) ────────────────────────────────────────────
  if (!entered) {
    return (
      <div className="h-dvh w-full relative overflow-hidden" style={{ background: t.bg }}>
        <Suspense fallback={<div className="h-full w-full" style={{ background: t.bg }} />}>
          {landingVariant === 'envelope' && <QsrLandingEnvelope onEnter={enter} />}
          {landingVariant === 'particles' && <QsrLandingParticles onEnter={enter} />}
          {landingVariant === 'bowl' && <QsrLandingBowl onEnter={enter} />}
        </Suspense>

        {/* Variant switcher — pitch tool to test all three heroes. */}
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-full"
          style={{ background: 'rgba(251,247,236,0.86)', border: `1px solid ${t.ruleColor}`, backdropFilter: 'blur(10px)' }}
        >
          {LANDING_VARIANTS.map(v => {
            const active = v.id === landingVariant
            return (
              <button
                key={v.id}
                onClick={() => setLandingVariant(v.id)}
                aria-pressed={active}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: active ? t.accent : 'transparent',
                  color: active ? '#fff' : t.inkSoft,
                  fontFamily: t.descFont,
                }}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Menu surface (post-entry) ─────────────────────────────────────────────
  const barBg =
    t.bg === '#F5EFE2' ? '#FBF8F0' : t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6'

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden" style={{ background: t.bg }}>
      <header
        className="shrink-0 sticky top-0 z-30"
        style={{ background: barBg, borderBottom: `1px solid ${t.ruleColor}` }}
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 pt-3 pb-2 flex items-center gap-3">
          <button onClick={() => setEntered(false)} className="min-w-0 text-left" title="Back to landing">
            <p
              className="text-[10px] sm:text-[11px] uppercase mb-0.5"
              style={{ ...bodyStyle(t), letterSpacing: '0.2em' }}
            >
              The Table Theory · Food · Coffee · Conversations
            </p>
            <h1 className="text-[20px] sm:text-[24px] leading-none truncate" style={headingStyle(t)}>
              {VIEW_TITLE[view]}
            </h1>
          </button>
          <div className="ml-auto shrink-0">
            <SegmentedControl
              ariaLabel="QSR view"
              options={VIEW_OPTIONS}
              value={view}
              onChange={setView}
            />
          </div>
        </div>
        <p
          className="hidden sm:block mx-auto w-full max-w-screen-xl px-6 pb-3 text-[12px] max-w-2xl leading-snug"
          style={bodyStyle(t)}
        >
          {BLURB[view]}
        </p>
      </header>

      {session.enabled && <SessionBanner session={session} />}

      <main className="flex-1 min-h-0 w-full">
        <div className="mx-auto w-full max-w-screen-xl h-full">
          {view === 'waiter' ? (
            <WaiterCopilot order={order} session={session} />
          ) : (
            <GuestFastMenu order={order} session={session} menuMap={menu.byCode} />
          )}
        </div>
      </main>
    </div>
  )
}
