import { Sparkles, Bell, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'

interface BottomNavProps {
  orderCount: number
  onAskAI: () => void
  onWaiter: () => void
  onViewOrder: () => void
}

export function BottomNav({ orderCount, onAskAI, onWaiter, onViewOrder }: BottomNavProps) {
  return (
    <div
      className="flex items-stretch"
      style={{
        background: 'var(--paper)',
        borderTop: '1.5px solid var(--gold)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <NavBtn icon={<Sparkles size={16} />} label="Ask AI" onClick={onAskAI} />
      <div style={{ width: 1, background: 'rgba(217,160,58,0.4)' }} />
      <NavBtn icon={<Bell size={16} />} label="Waiter" onClick={onWaiter} />
      <div style={{ width: 1, background: 'rgba(217,160,58,0.4)' }} />
      <NavBtn
        icon={
          <div className="relative">
            <ShoppingBag size={16} />
            {orderCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: 'var(--maroon)' }}
              >
                {orderCount}
              </span>
            )}
          </div>
        }
        label="Order"
        onClick={onViewOrder}
      />
    </div>
  )
}

function NavBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 font-inter text-[10px] font-medium tracking-wide uppercase select-none"
      style={{ color: 'var(--ink-soft)' }}
    >
      {icon}
      {label}
    </motion.button>
  )
}
