import { useState } from 'react'
import { motion } from 'framer-motion'
import { type MenuItem } from '../../data/menu'
import { Badge } from '../atoms/Badge'
import { Price } from '../atoms/Price'
import { fadeUp } from '../../animations/variants'

const CATEGORY_THUMB: Record<string, { bg: string; emoji: string }> = {
  beverages:  { bg: 'linear-gradient(135deg,rgba(217,160,58,0.18),rgba(244,208,63,0.28))', emoji: '🥤' },
  soups:      { bg: 'linear-gradient(135deg,rgba(139,16,36,0.10),rgba(217,160,58,0.18))', emoji: '🍜' },
  quickbites: { bg: 'linear-gradient(135deg,rgba(79,122,60,0.10),rgba(217,160,58,0.15))', emoji: '🧆' },
  italian:    { bg: 'linear-gradient(135deg,rgba(215,25,32,0.08),rgba(217,160,58,0.18))', emoji: '🍝' },
  desserts:   { bg: 'linear-gradient(135deg,rgba(217,160,58,0.18),rgba(139,16,36,0.08))', emoji: '🍮' },
}

function categoryFromItemId(id: string): string {
  if (id.startsWith('bev'))  return 'beverages'
  if (id.startsWith('soup')) return 'soups'
  if (id.startsWith('qb'))   return 'quickbites'
  if (id.startsWith('ita'))  return 'italian'
  return 'desserts'
}

interface MenuCardProps {
  item: MenuItem
  onTap: (item: MenuItem) => void
}

export function MenuCard({ item, onTap }: MenuCardProps) {
  const cat = CATEGORY_THUMB[categoryFromItemId(item.id)] ?? CATEGORY_THUMB.quickbites
  const [imgErr, setImgErr] = useState(false)

  return (
    <motion.div
      variants={fadeUp}
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap(item)}
      className="flex items-start gap-3 p-3 rounded-2xl cursor-pointer"
      style={{
        background: 'var(--paper)',
        border: '1px solid rgba(217,160,58,0.25)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Dish thumbnail — real photo with emoji fallback */}
      <div
        className="w-16 h-16 rounded-xl flex-shrink-0 relative overflow-hidden flex items-center justify-center"
        style={{
          background: cat.bg,
          border: '1px solid rgba(217,160,58,0.28)',
        }}
      >
        {!imgErr ? (
          <img
            src={`/assets/dishes/${item.id}.webp`}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span style={{ fontSize: 28, lineHeight: 1, userSelect: 'none' }}>{cat.emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-playfair font-semibold text-[14px] text-ink leading-snug">{item.name}</h3>
          <Price amount={item.price} size="sm" className="flex-shrink-0 mt-0.5" />
        </div>
        <p className="font-inter text-[11px] text-ink-soft mt-0.5 leading-relaxed line-clamp-2">
          {item.description}
        </p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {item.isJain && <Badge variant="jain">Jain</Badge>}
          {item.canBeJain && !item.isJain && <Badge variant="jain">Can be Jain</Badge>}
          {item.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="tag">{tag}</Badge>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
