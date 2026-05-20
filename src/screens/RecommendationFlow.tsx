import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Sparkles, ArrowRight } from 'lucide-react'
import { Chip } from '../components/atoms/Chip'
import { Button } from '../components/atoms/Button'
import { Price } from '../components/atoms/Price'
import { getItemById } from '../data/menu'
import { useRecommendation, type RecommendationAnswers } from '../hooks/useRecommendation'
import { questionReveal, stagger, scaleIn } from '../animations/variants'

const MOODS = [
  'Light & Fresh', 'Cheesy & Comforting', 'Spicy', 'Italian',
  'Mexican', 'Sizzler', 'Dessert', 'Drinks only',
]
const PARTY_SIZES = ['Just me', 'Two people', 'Family / group', 'Kids', 'Jain preference']

const QUESTIONS = [
  { key: 'moods' as const,      label: "What are you in the mood for?",  hint: "Pick as many as you like", options: MOODS },
  { key: 'partySizes' as const, label: 'Who are you ordering for?',       hint: 'Select all that apply',    options: PARTY_SIZES },
]

interface RecommendationFlowProps {
  onBack: () => void
  onOpenMenu: () => void
  onWaiter?: () => void
}

export function RecommendationFlow({ onBack, onOpenMenu, onWaiter }: RecommendationFlowProps) {
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<{ moods: string[]; partySizes: string[] }>({
    moods: [],
    partySizes: [],
  })
  const [showResults, setShowResults] = useState(false)

  const currentKey = QUESTIONS[step].key
  const currentSelections: string[] = selections[currentKey]
  const hasSelection = currentSelections.length > 0

  const finalAnswers: RecommendationAnswers | null =
    selections.moods.length > 0 || selections.partySizes.length > 0
      ? { moods: selections.moods, partySizes: selections.partySizes }
      : null

  const results = useRecommendation(finalAnswers)

  const toggleOption = (value: string) => {
    setSelections(prev => {
      const arr = prev[currentKey]
      const updated = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      return { ...prev, [currentKey]: updated }
    })
  }

  const handleContinue = () => {
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1)
    } else {
      setShowResults(true)
    }
  }

  const reset = () => {
    setStep(0)
    setSelections({ moods: [], partySizes: [] })
    setShowResults(false)
  }

  return (
    <div className="flex flex-col paper-bg" style={{ height: '100dvh', overflow: 'hidden' }}>
      {/* Header — fixed */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(217,160,58,0.25)', background: 'var(--paper)' }}
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(139,16,36,0.08)' }}
        >
          <ChevronLeft size={18} style={{ color: 'var(--maroon)' }} />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h2 className="font-playfair font-bold text-[17px] leading-tight" style={{ color: 'var(--maroon)' }}>
            Ask Relish AI
          </h2>
          <p className="font-inter text-[10px] uppercase tracking-wider" style={{ color: 'var(--mute)' }}>
            Personalised recommendations
          </p>
        </div>
        <Sparkles size={18} style={{ color: 'var(--gold)' }} className="flex-shrink-0" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 pb-28">
          <AnimatePresence mode="wait">
            {!showResults ? (
              <motion.div
                key={`step-${step}`}
                variants={questionReveal}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex flex-col gap-5"
              >
                {/* Progress */}
                <div className="flex gap-2">
                  {QUESTIONS.map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === step ? 24 : 6,
                        height: 6,
                        background: i < step
                          ? 'var(--gold)'
                          : i === step
                            ? 'var(--maroon)'
                            : 'rgba(139,16,36,0.15)',
                      }}
                    />
                  ))}
                </div>

                {/* Question */}
                <div>
                  <p className="font-inter text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
                    Step {step + 1} of {QUESTIONS.length}
                  </p>
                  <h3 className="font-playfair font-semibold text-[20px] leading-snug" style={{ color: 'var(--maroon)' }}>
                    {QUESTIONS[step].label}
                  </h3>
                  <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--mute)' }}>
                    {QUESTIONS[step].hint}
                  </p>
                </div>

                {/* Chips — multi-select */}
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-wrap gap-2"
                >
                  {QUESTIONS[step].options.map(opt => (
                    <motion.div key={opt} variants={scaleIn}>
                      <Chip
                        active={currentSelections.includes(opt)}
                        onClick={() => toggleOption(opt)}
                      >
                        {opt}
                      </Chip>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Previous step summary */}
                {step > 0 && selections.moods.length > 0 && (
                  <div
                    className="p-3 rounded-xl"
                    style={{ background: 'rgba(217,160,58,0.08)', border: '1px solid rgba(217,160,58,0.2)' }}
                  >
                    <p className="font-inter text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      <span className="font-semibold" style={{ color: 'var(--maroon)' }}>Mood: </span>
                      {selections.moods.join(', ')}
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-5"
              >
                {/* Results header */}
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                    style={{ background: 'rgba(217,160,58,0.15)' }}
                  >
                    <Sparkles size={22} style={{ color: 'var(--gold)' }} />
                  </motion.div>
                  <h3 className="font-playfair font-bold text-[22px]" style={{ color: 'var(--maroon)' }}>
                    Your Relish Picks
                  </h3>
                  <p className="font-inter text-[12px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                    Based on your preferences
                  </p>

                  {/* Selection summary pills */}
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {[...selections.moods, ...selections.partySizes].map(s => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full font-inter text-[11px]"
                        style={{ background: 'rgba(139,16,36,0.08)', color: 'var(--maroon)' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Result cards */}
                {results.map((path, i) => (
                  <motion.div
                    key={path.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12, type: 'spring', stiffness: 280, damping: 26 }}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      border: path.isTopPick ? '1.5px solid var(--gold)' : '1px solid rgba(217,160,58,0.25)',
                      boxShadow: path.isTopPick ? '0 4px 20px rgba(217,160,58,0.2)' : 'var(--shadow-card)',
                    }}
                  >
                    {path.isTopPick && (
                      <div
                        className="px-4 py-1.5 text-center font-inter text-[10px] font-semibold uppercase tracking-widest text-white"
                        style={{ background: 'var(--gold)' }}
                      >
                        ✦ Top Pick for You
                      </div>
                    )}
                    <div className="p-4 paper-bg">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-playfair font-bold text-[16px]" style={{ color: 'var(--maroon)' }}>
                          {path.name}
                        </h4>
                        <Price amount={path.estimatedPrice} size="md" />
                      </div>
                      <p className="font-cormorant italic text-[13px] mb-3" style={{ color: 'var(--ink-soft)' }}>
                        {path.tagline}
                      </p>

                      {/* Dish list */}
                      <div className="flex flex-col gap-1.5 mb-3">
                        {path.itemIds.map(id => {
                          const item = getItemById(id)
                          return item ? (
                            <div key={id} className="flex justify-between items-center">
                              <span className="font-inter text-[12px]" style={{ color: 'var(--ink)' }}>
                                • {item.name}
                              </span>
                              <Price amount={item.price} size="sm" />
                            </div>
                          ) : null
                        })}
                      </div>

                      <p className="font-inter text-[11px] mb-4 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                        {path.reason}
                      </p>

                      <div className="flex gap-2">
                        <Button variant="maroon" onClick={onOpenMenu} className="flex-1 text-xs py-2">
                          Explore Menu
                        </Button>
                        {onWaiter && (
                          <Button variant="ghost" onClick={onWaiter} className="flex-1 text-xs py-2">
                            Ask Waiter
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {results.length === 0 && (
                  <div className="text-center py-8">
                    <p className="font-inter text-[14px]" style={{ color: 'var(--ink-soft)' }}>
                      Everything on our menu is worth trying!
                    </p>
                    <Button variant="maroon" onClick={onOpenMenu} className="mt-4">
                      Browse Menu
                    </Button>
                  </div>
                )}

                <button
                  onClick={reset}
                  className="mx-auto font-inter text-[12px] underline underline-offset-2 pb-4"
                  style={{ color: 'var(--mute)' }}
                >
                  Start over
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Continue button — fixed at bottom, only when not showing results */}
      <AnimatePresence>
        {!showResults && (
          <motion.div
            key="continue-btn"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3"
            style={{
              background: 'linear-gradient(to top, var(--paper) 60%, transparent)',
              pointerEvents: hasSelection ? 'auto' : 'none',
            }}
          >
            <motion.button
              whileTap={{ scale: hasSelection ? 0.97 : 1 }}
              onClick={hasSelection ? handleContinue : undefined}
              className="w-full py-3.5 rounded-full font-inter font-semibold text-[14px] flex items-center justify-center gap-2 transition-all duration-200"
              style={{
                background: hasSelection ? 'var(--maroon)' : 'rgba(139,16,36,0.15)',
                color: hasSelection ? 'white' : 'rgba(139,16,36,0.4)',
              }}
            >
              {step < QUESTIONS.length - 1 ? (
                <>Next <ArrowRight size={16} /></>
              ) : (
                <>Show my picks <Sparkles size={14} /></>
              )}
            </motion.button>
            {!hasSelection && (
              <p className="text-center font-inter text-[11px] mt-2" style={{ color: 'var(--mute)' }}>
                Select at least one option to continue
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
