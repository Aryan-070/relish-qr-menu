import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { categories } from '../../data/menu'

const CATEGORY_EMOJI: Record<string, string> = {
  beverages:  '🥤',
  soups:      '🍜',
  quickbites: '🧆',
  italian:    '🍝',
  desserts:   '🍮',
}

interface CategoryNavProps {
  activeId: string
  onChange: (id: string) => void
}

export function CategoryNav({ activeId, onChange }: CategoryNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeId])

  const handleSelect = (id: string) => {
    onChange(id)
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar"
      style={{ background: 'var(--paper-2)' }}
    >
      {categories.map(cat => {
        const isActive = cat.id === activeId
        return (
          <div key={cat.id} data-cat={cat.id} className="relative flex-shrink-0">
            <button
              onClick={() => handleSelect(cat.id)}
              className={[
                'relative px-4 py-1.5 rounded-full font-inter text-[13px] font-medium transition-all duration-200 select-none',
                isActive
                  ? 'text-white'
                  : 'text-ink-soft hover:text-maroon',
              ].join(' ')}
              style={{ zIndex: 1 }}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full bg-maroon"
                  style={{ zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="mr-1">{CATEGORY_EMOJI[cat.id]}</span>{cat.name}
            </button>
          </div>
        )
      })}
    </div>
  )
}
