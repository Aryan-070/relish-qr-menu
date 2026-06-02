import { Sparkles, Bell, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import type { ThemeTokens } from '../../theme/themes'

interface BottomNavProps {
  orderCount: number
  onAskAI: () => void
  onWaiter: () => void
  onViewOrder: () => void
}

export function BottomNav({ orderCount, onAskAI, onWaiter, onViewOrder }: BottomNavProps) {
  const { tokens: t } = useTheme()
  const hard = t.navStyle === 'underline'
  const divider = hard ? t.ruleColor : 'rgba(217,160,58,0.4)'

  return (
    <nav
      aria-label="Main navigation"
      className="w-full"
      style={{
        background: t.bg,
        borderTop: hard ? `1.5px solid ${t.ruleColor}` : '1.5px solid var(--gold)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
    <div className="flex items-stretch w-full max-w-5xl mx-auto">
      <NavBtn icon={<Sparkles size={16} />} label="Ask AI" onClick={onAskAI} theme={t} />
      <div style={{ width: 1, background: divider }} />
      <NavBtn icon={<Bell size={16} />} label="Waiter" onClick={onWaiter} theme={t} />
      <div style={{ width: 1, background: divider }} />
      <NavBtn
        icon={
          <div className="relative">
            <ShoppingBag size={16} />
            {orderCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: t.accent, borderRadius: t.addShape === 'square' ? 0 : 9999 }}
              >
                {orderCount}
              </span>
            )}
          </div>
        }
        label="Order"
        onClick={onViewOrder}
        theme={t}
      />
    </div>
    </nav>
  )
}

function NavBtn({
  icon,
  label,
  onClick,
  theme: t,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  theme: ThemeTokens
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 uppercase select-none"
      style={{
        color: t.inkSoft,
        fontFamily: t.navStyle === 'underline' ? t.descFont : 'Inter, sans-serif',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        minHeight: 48,
      }}
    >
      {icon}
      {label}
    </motion.button>
  )
}
