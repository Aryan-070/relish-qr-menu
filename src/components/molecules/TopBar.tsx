import { getCategoryById } from '../../data/menu'
import { BellRipple } from '../animations/BellRipple'
import { useTheme } from '../../theme/ThemeContext'

interface TopBarProps {
  activeCategoryId: string
  onWaiter: () => void
}

export function TopBar({ activeCategoryId, onWaiter }: TopBarProps) {
  const { tokens: t } = useTheme()
  const category = getCategoryById(activeCategoryId)
  const hard = t.navStyle === 'underline'

  return (
    <div
      className="w-full"
      style={{
        background: t.bg,
        borderBottom: hard ? `1.5px solid ${t.ruleColor}` : '1px solid rgba(217,160,58,0.3)',
      }}
    >
    <div className="flex items-center justify-between px-4 py-3 w-full max-w-5xl mx-auto">
      {/* Logo */}
      <div className="flex flex-col leading-none">
        <span
          className="font-bold uppercase"
          style={{
            fontFamily: t.headerFont,
            fontSize: 18,
            color: t.headerColor,
            letterSpacing: t.headerTransform === 'uppercase' ? '0.04em' : '0.18em',
          }}
        >
          RELISH
        </span>
        <span
          className="uppercase tracking-widest"
          style={{
            fontFamily: hard ? t.descFont : 'Inter, sans-serif',
            fontSize: 7,
            color: t.inkSoft,
            letterSpacing: '0.2em',
            marginTop: 2,
            opacity: 0.7,
          }}
        >
          International Veg Cuisine
        </span>
      </div>

      {/* Active category name */}
      {category && (
        <span
          style={{
            fontFamily: t.accentFont,
            fontStyle: hard ? 'normal' : 'italic',
            textTransform: hard ? 'uppercase' : 'none',
            fontSize: hard ? 10 : 14,
            letterSpacing: hard ? '0.08em' : 'normal',
            color: t.inkSoft,
          }}
        >
          {category.name}
        </span>
      )}

      {/* Waiter bell */}
      <div
        className="relative flex items-center justify-center overflow-visible"
        style={{
          width: 44,
          height: 44,
          borderRadius: t.addShape === 'square' ? 0 : 9999,
          background: hard ? 'transparent' : 'rgba(217,160,58,0.12)',
          border: hard ? `1.5px solid ${t.ruleColor}` : '1px solid rgba(217,160,58,0.3)',
        }}
      >
        <BellRipple size={16} color={hard ? t.accent : '#D9A03A'} onClick={onWaiter} />
      </div>
    </div>
    </div>
  )
}
