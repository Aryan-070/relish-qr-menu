import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { categories } from '../../data/menu'
import { useTheme } from '../../theme/ThemeContext'
import { CategoryIcon } from '../../lib/categoryIcons'

interface CategoryNavProps {
  activeId: string
  onChange: (id: string) => void
}

export function CategoryNav({ activeId, onChange }: CategoryNavProps) {
  const { tokens: t } = useTheme()
  const scrollRef = useRef<HTMLDivElement>(null)
  const underline = t.navStyle === 'underline'

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeId])

  return (
    <div
      className="w-full"
      style={{
        background: underline ? t.bg : 'var(--paper-2)',
        borderBottom: underline ? `1.5px solid ${t.ruleColor}` : 'none',
      }}
    >
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar w-full max-w-5xl mx-auto"
    >
      {categories.map(cat => {
        const isActive = cat.id === activeId
        return (
          <div key={cat.id} data-cat={cat.id} className="relative flex-shrink-0">
            <button
              onClick={() => onChange(cat.id)}
              aria-current={isActive ? 'true' : undefined}
              className="relative select-none transition-colors duration-200"
              style={{
                minHeight: 40,
                padding: underline ? '8px 8px' : '6px 16px',
                borderRadius: underline ? 0 : 9999,
                fontFamily: underline ? t.descFont : 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: underline ? 700 : 500,
                textTransform: underline ? 'uppercase' : 'none',
                letterSpacing: underline ? '0.04em' : 'normal',
                color: isActive ? (underline ? t.ink : '#fff') : t.inkSoft,
                zIndex: 1,
              }}
            >
              {/* Active indicator */}
              {isActive && !underline && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: t.accent, zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {isActive && underline && (
                <motion.div
                  layoutId="active-underline"
                  className="absolute left-1 right-1"
                  style={{ bottom: -8, height: 3, background: t.accent }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="inline-flex items-center gap-1.5">
                {!underline && (
                  <CategoryIcon
                    categoryId={cat.id}
                    size={15}
                    color={isActive ? '#fff' : t.inkSoft}
                  />
                )}
                {cat.name}
              </span>
            </button>
          </div>
        )
      })}
    </div>
    </div>
  )
}
