import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeContext'
import { isHard, bodyStyle } from '../../console/lib/skin'
import { CRAVINGS, MOODS, DIET_FILTERS, type Craving, type QsrMood, type DietFilter } from '../../data/qsrMenu'

// ── The Table Theory "Taste Pass" — the QSR recommendation concept ──────────
// Three live preference axes that re-rank the menu and drive the whisper: a soft
// craving rail (Spicy / Cheesy / Protein / Light / Comfort / Sweet), a hard
// dietary gate (Veg / Non-veg / Vegan / GF / Nut-free / Dairy-free — Veg and
// Non-veg are mutually exclusive, enforced by the parent), and a table mood
// (Solo / Date / Friends / Work) that also picks the envelope card.

export interface TastePassProps {
  cravings: ReadonlySet<Craving>
  onToggleCraving: (c: Craving) => void
  dietary: ReadonlySet<DietFilter>
  onToggleDietary: (d: DietFilter) => void
  mood: QsrMood | null
  onSetMood: (m: QsrMood | null) => void
}

export function TastePass({
  cravings, onToggleCraving, dietary, onToggleDietary, mood, onSetMood,
}: TastePassProps) {
  const { tokens: t } = useTheme()
  const radius = isHard(t) ? 4 : 999

  const chipBase = 'relative text-[12px] font-medium px-3 py-1.5 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer select-none'

  return (
    <div className="flex flex-col gap-2.5">
      {/* Craving rail */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] mb-1.5" style={bodyStyle(t)}>
          What are you craving?
        </p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CRAVINGS.map(c => {
            const active = cravings.has(c.id)
            return (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => onToggleCraving(c.id)}
                aria-pressed={active}
                className={chipBase}
                style={{
                  borderRadius: radius,
                  background: active ? t.accent : 'rgba(0,0,0,0.045)',
                  color: active ? '#fff' : t.ink,
                  border: `1px solid ${active ? t.accent : t.ruleColor}`,
                  fontFamily: t.descFont,
                }}
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Dietary gate */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] pt-1.5 w-8 flex-shrink-0" style={bodyStyle(t)}>Diet</span>
        <div className="flex flex-wrap gap-1.5">
          {DIET_FILTERS.map(d => {
            const active = dietary.has(d.id)
            return (
              <motion.button
                key={d.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => onToggleDietary(d.id)}
                aria-pressed={active}
                className="text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                style={{
                  borderRadius: radius,
                  background: active ? '#2e7d4f' : 'rgba(46,125,79,0.10)',
                  color: active ? '#fff' : '#2e7d4f',
                  border: `1px solid ${active ? '#2e7d4f' : 'rgba(46,125,79,0.3)'}`,
                  fontFamily: t.descFont,
                }}
              >
                {d.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Table mood */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] w-8 flex-shrink-0" style={bodyStyle(t)}>Table</span>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map(m => {
            const active = mood === m.id
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSetMood(active ? null : m.id)}
                aria-pressed={active}
                title={m.sub}
                className="text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer"
                style={{
                  borderRadius: radius,
                  background: active ? t.accent2 : 'rgba(143,179,154,0.14)',
                  color: active ? '#14331f' : t.inkSoft,
                  border: `1px solid ${active ? t.accent2 : t.ruleColor}`,
                  fontFamily: t.descFont,
                }}
              >
                {m.label}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
