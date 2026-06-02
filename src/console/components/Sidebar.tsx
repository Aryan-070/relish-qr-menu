import { motion } from 'framer-motion'
import { UtensilsCrossed, LogOut } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'
import { cn } from '../lib/format'
import { NAV, ROLE_LABEL, type ConsoleView } from '../nav'
import type { Role } from '../lib/types'

interface SidebarProps {
  role: Role
  activeView: ConsoleView
  onNavigate: (view: ConsoleView) => void
  onExit: () => void
  pendingCount: number
}

export function Sidebar({ role, activeView, onNavigate, onExit, pendingCount }: SidebarProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  const dark = t.bg === '#F4F4F0' ? '#141414' : '#4a0813'
  const panelBg = hard
    ? dark
    : 'linear-gradient(180deg, #6d0d1c 0%, #4a0813 100%)'
  const cream = 'rgba(255,248,234,0.92)'
  const dim = 'rgba(255,248,234,0.58)'

  return (
    <nav
      aria-label="Console sections"
      className="shrink-0 h-full flex flex-col w-[64px] md:w-[232px] transition-[width]"
      style={{ background: panelBg, color: cream }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 md:px-5 h-16 shrink-0" style={{ borderBottom: '1px solid rgba(255,248,234,0.12)' }}>
        <span
          className="w-9 h-9 inline-flex items-center justify-center shrink-0"
          style={{ background: 'rgba(217,160,58,0.22)', borderRadius: hard ? 0 : 10, color: '#E9C77D' }}
        >
          <UtensilsCrossed size={18} />
        </span>
        <div className="hidden md:block min-w-0">
          <p className="text-[15px] leading-tight truncate" style={{ fontFamily: t.headerFont, fontWeight: 700 }}>
            Relish
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: dim }}>
            Console
          </p>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex-1 overflow-y-auto py-3 px-2 md:px-3 flex flex-col gap-1">
        {NAV[role].map(item => {
          const active = item.view === activeView
          const Icon = item.icon
          const showBadge = item.badge === 'pending-requests' && pendingCount > 0
          return (
            <li key={item.view}>
              <button
                onClick={() => onNavigate(item.view)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  'relative w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  'justify-center md:justify-start',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E9C77D]',
                )}
                style={{ borderRadius: hard ? 0 : 10, color: active ? '#fff' : dim }}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 -z-0"
                    style={{ background: 'rgba(217,160,58,0.20)', borderRadius: hard ? 0 : 10, border: '1px solid rgba(217,160,58,0.4)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10 shrink-0">
                  <Icon size={19} />
                </span>
                <span className="relative z-10 hidden md:block text-[13.5px] font-medium" style={{ fontFamily: t.descFont }}>
                  {item.label}
                </span>
                {showBadge && (
                  <span
                    className="relative z-10 ml-auto hidden md:inline-flex items-center justify-center text-[10px] font-bold px-1.5 min-w-[18px] h-[18px]"
                    style={{ background: '#D71920', color: '#fff', borderRadius: hard ? 0 : 999 }}
                  >
                    {pendingCount}
                  </span>
                )}
                {showBadge && (
                  <span className="md:hidden absolute top-1.5 right-2 w-2 h-2 rounded-full" style={{ background: '#D71920' }} />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="px-2 md:px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,248,234,0.12)' }}>
        <div className="hidden md:block px-2 pb-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: dim }}>
          {ROLE_LABEL[role]} view
        </div>
        <button
          onClick={onExit}
          className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer justify-center md:justify-start hover:bg-white/5"
          style={{ borderRadius: hard ? 0 : 10, color: cream }}
          aria-label="Exit to guest menu"
          title="Exit to guest menu"
        >
          <LogOut size={18} className="shrink-0" />
          <span className="hidden md:block text-[13px]" style={{ fontFamily: t.descFont }}>
            Exit to menu
          </span>
        </button>
      </div>
    </nav>
  )
}
