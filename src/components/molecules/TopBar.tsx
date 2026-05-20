import { getCategoryById } from '../../data/menu'
import { BellRipple } from '../animations/BellRipple'

interface TopBarProps {
  activeCategoryId: string
  onWaiter: () => void
}

export function TopBar({ activeCategoryId, onWaiter }: TopBarProps) {
  const category = getCategoryById(activeCategoryId)

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background: 'var(--paper)',
        borderBottom: '1px solid rgba(217,160,58,0.3)',
      }}
    >
      {/* Logo */}
      <div className="flex flex-col leading-none">
        <span
          className="font-playfair font-bold tracking-widest uppercase"
          style={{ fontSize: 18, color: 'var(--maroon)', letterSpacing: '0.18em' }}
        >
          RELISH
        </span>
        <span
          className="font-inter uppercase tracking-widest"
          style={{ fontSize: 7, color: 'var(--gold)', letterSpacing: '0.2em', marginTop: 1 }}
        >
          International Veg Cuisine
        </span>
      </div>

      {/* Category name */}
      {category && (
        <span
          className="font-playfair font-medium italic"
          style={{ fontSize: 13, color: 'var(--ink-soft)' }}
        >
          {category.name}
        </span>
      )}

      {/* Waiter bell */}
      <div
        className="relative flex items-center justify-center w-9 h-9 rounded-full overflow-visible"
        style={{ background: 'rgba(217,160,58,0.12)', border: '1px solid rgba(217,160,58,0.3)' }}
      >
        <BellRipple size={15} color="#D9A03A" onClick={onWaiter} />
      </div>
    </div>
  )
}
