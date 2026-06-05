import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, X, Flame } from 'lucide-react'
import type { MenuItem } from '../data/menu'
import { useMenuData } from '../data/MenuDataContext'
import { DIETARY_FILTERS, type DietaryTag } from '../data/dietary'
import { useMenuSearch } from '../hooks/useMenuSearch'
import { MenuCard } from '../components/molecules/MenuCard'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'

interface MenuSearchProps {
  onClose: () => void
  onItemTap: (item: MenuItem) => void
}

export function MenuSearch({ onClose, onItemTap }: MenuSearchProps) {
  const { tokens: t } = useTheme()
  const tr = useT()
  const { getCategoryById } = useMenuData()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Set<DietaryTag>>(new Set())
  const [maxSpice, setMaxSpice] = useState<number | undefined>(undefined)

  const { results, total, isFiltering } = useMenuSearch({ query, filters, maxSpice })

  const toggleFilter = (id: DietaryTag) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group results by category for a scannable list
  const grouped = results.reduce<Record<string, MenuItem[]>>((acc, { item, categoryId }) => {
    ;(acc[categoryId] ??= []).push(item)
    return acc
  }, {})

  const hard = t.navStyle === 'underline'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col paper-bg"
      style={{ zIndex: 40, background: t.bg }}
    >
      {/* Search header */}
      <div
        className="flex-shrink-0"
        style={{
          background: t.bg,
          borderBottom: hard ? `1.5px solid ${t.ruleColor}` : '1px solid rgba(217,160,58,0.3)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-3 w-full max-w-5xl mx-auto">
          <button
            onClick={onClose}
            aria-label="Back to menu"
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: t.addShape === 'square' ? 0 : 9999,
              border: hard ? `1.5px solid ${t.ruleColor}` : '1px solid rgba(217,160,58,0.3)',
              background: 'transparent',
              color: t.ink,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>

          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            style={{
              borderRadius: t.addShape === 'square' ? 0 : 9999,
              border: hard ? `1.5px solid ${t.ruleColor}` : '1px solid rgba(217,160,58,0.4)',
              background: hard ? 'transparent' : 'rgba(217,160,58,0.08)',
              padding: '0 12px',
              height: 40,
            }}
          >
            <Search size={16} strokeWidth={2} style={{ color: t.accent, flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('search.placeholder')}
              className="flex-1 min-w-0 bg-transparent outline-none"
              style={{ fontFamily: t.descFont, fontSize: 14, color: t.ink }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.inkSoft, display: 'flex' }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-3 pb-3 w-full max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {DIETARY_FILTERS.map(f => (
            <FilterChip key={f.id} label={f.label} active={filters.has(f.id)} onClick={() => toggleFilter(f.id)} theme={t} />
          ))}
          <FilterChip
            label={tr('search.mildOnly')}
            icon={<Flame size={11} strokeWidth={2} />}
            active={maxSpice === 1}
            onClick={() => setMaxSpice(prev => (prev === 1 ? undefined : 1))}
            theme={t}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4 w-full max-w-5xl mx-auto">
        <p style={{ fontFamily: t.descFont, fontSize: 12, color: t.inkSoft, marginBottom: 12 }}>
          {isFiltering
            ? `${total} ${total === 1 ? tr('search.dishSingular') : tr('search.dishPlural')}`
            : `${total} ${tr('search.dishPlural')} ${tr('search.onTheMenu')}`}
        </p>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 48, gap: 8 }}>
            <Search size={28} strokeWidth={1.5} style={{ color: t.accent, opacity: 0.6 }} />
            <p style={{ fontFamily: t.accentFont, fontStyle: hard ? 'normal' : 'italic', fontSize: 15, color: t.ink }}>
              {tr('search.noMatch')}
            </p>
            <p style={{ fontFamily: t.descFont, fontSize: 12.5, color: t.inkSoft, maxWidth: 240 }}>
              {tr('search.tryDifferent')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(grouped).map(([catId, items]) => (
              <div key={catId}>
                <h3
                  style={{
                    fontFamily: t.titleFont,
                    textTransform: t.titleTransform,
                    fontWeight: t.titleWeight,
                    fontSize: 13,
                    letterSpacing: '0.06em',
                    color: t.inkSoft,
                    marginBottom: 8,
                  }}
                >
                  {getCategoryById(catId)?.name ?? catId}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(item => (
                    <MenuCard key={item.id} item={item} onTap={onItemTap} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

type Tokens = ReturnType<typeof useTheme>['tokens']

function FilterChip({
  label,
  active,
  onClick,
  theme: t,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  theme: Tokens
  icon?: React.ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="flex items-center gap-1 flex-shrink-0"
      style={{
        fontFamily: t.descFont,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: active ? '#FFF8EA' : t.ink,
        background: active ? t.accent : 'transparent',
        border: `1px solid ${active ? t.accent : 'rgba(217,160,58,0.45)'}`,
        borderRadius: t.addShape === 'square' ? 0 : 9999,
        padding: '6px 12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </motion.button>
  )
}
