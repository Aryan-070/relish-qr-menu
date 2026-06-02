// Phase 6.4 — video-egress metering surface for the Billing dashboard.
//
// Small, tasteful panel that sits in the Billing grid: two headline stats
// (active screens + bandwidth served this cycle) and a compact per-screen list.
// Demo mode shows a deterministic per-package mock; Supabase mode reads the
// real video_screens rows. Packages without on-menu video (web-menu / classic)
// get a friendly empty state instead of an empty list.

import { useTheme } from '../../theme/ThemeContext'
import { Panel } from '../components/Panel'
import { useVideoUsage } from '../lib/useVideoUsage'
import { formatBytes } from '../lib/videoUsageRepo'
import type { PackageId } from '../lib/billing'

interface VideoUsagePanelProps {
  packageId: PackageId
  restaurantId: string | null
}

export function VideoUsagePanel({ packageId, restaurantId }: VideoUsagePanelProps) {
  const { tokens: t } = useTheme()
  const { loading, usage, error, source } = useVideoUsage(packageId, restaurantId)

  const noVideo = source === 'demo' && usage.activeCount === 0

  return (
    <Panel title="Video usage" subtitle="This billing cycle">
      {loading ? (
        <p className="text-[13px] py-4" style={{ color: t.descColor, fontFamily: t.descFont }}>
          Loading usage…
        </p>
      ) : error ? (
        <p className="text-[13px] py-4" style={{ color: '#b3141b', fontFamily: t.descFont }}>
          Couldn’t load usage — {error}
        </p>
      ) : noVideo ? (
        <p className="text-[13px] py-4" style={{ color: t.descColor, fontFamily: t.descFont }}>
          No video screens on this package.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Active screens"
              value={String(usage.activeCount)}
            />
            <Stat
              label="Bandwidth served"
              value={formatBytes(usage.totalBytes)}
            />
          </div>

          {/* Per-screen breakdown */}
          <ul className="flex flex-col">
            {usage.screens.map((screen, i) => (
              <li
                key={screen.id}
                className="flex items-center justify-between gap-3 py-2 text-[13px]"
                style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.ruleColor}` }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate" style={{ color: t.ink, fontFamily: t.descFont }}>
                    {screen.label}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider shrink-0"
                    style={{
                      color: screen.active ? '#3d6130' : t.descColor,
                      fontFamily: t.descFont,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {screen.active ? 'active' : 'paused'}
                  </span>
                </span>
                <span
                  className="tabular-nums shrink-0"
                  style={{ color: t.descColor, fontFamily: t.priceFont }}
                >
                  {formatBytes(screen.bytesServed)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// Compact headline stat — large value over a quiet uppercase label.
function Stat({ label, value }: { label: string; value: string }) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: t.descColor, fontFamily: t.descFont, letterSpacing: '0.06em' }}
      >
        {label}
      </span>
      <span
        className="text-[20px] leading-none tabular-nums"
        style={{ fontFamily: t.headerFont, color: t.ink, fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  )
}
