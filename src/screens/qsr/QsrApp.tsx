import { useState } from 'react'
import { useOrder } from '../../hooks/useOrder'
import { useTheme } from '../../theme/ThemeContext'
import { SegmentedControl } from '../../console/components/SegmentedControl'
import { headingStyle, bodyStyle } from '../../console/lib/skin'
import { WaiterCopilot } from './WaiterCopilot'
import { GuestFastMenu } from './GuestFastMenu'

type QsrView = 'waiter' | 'guest'

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

/**
 * QSR prototype surface, mounted at `/qsr`. One shared cart, a "Staff / Guest"
 * toggle between the Waiter Copilot (the no-hardware pitch on the waiter's phone)
 * and the Guest Quick Menu (a faster, tile-first guest presentation).
 *
 * Two products sharing one cart: the waiter view is a cockpit (fast, glanceable),
 * the guest view a storefront. Fully theme-aware and responsive — single column on
 * mobile, expanding to use the desktop canvas. No fake device frame.
 */
export function QsrApp() {
  const order = useOrder()
  const { tokens: t } = useTheme()
  const [view, setView] = useState<QsrView>('waiter')

  // Elevated bar surface, mirroring the console TopBar treatment per theme.
  const barBg =
    t.bg === '#F5EFE2' ? '#FBF8F0' : t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6'

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden" style={{ background: t.bg }}>
      <header
        className="shrink-0 sticky top-0 z-30"
        style={{ background: barBg, borderBottom: `1px solid ${t.ruleColor}` }}
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 pt-3 pb-2 flex items-center gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] sm:text-[11px] uppercase mb-0.5"
              style={{ ...bodyStyle(t), letterSpacing: '0.2em' }}
            >
              The Table Theory · Food · Coffee · Conversations
            </p>
            <h1 className="text-[20px] sm:text-[24px] leading-none truncate" style={headingStyle(t)}>
              {VIEW_TITLE[view]}
            </h1>
          </div>
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

      <main className="flex-1 min-h-0 w-full">
        <div className="mx-auto w-full max-w-screen-xl h-full">
          {view === 'waiter' ? <WaiterCopilot order={order} /> : <GuestFastMenu order={order} />}
        </div>
      </main>
    </div>
  )
}
