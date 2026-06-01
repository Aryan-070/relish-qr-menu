import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronLeft, ChevronRight, CheckCircle2, Bell,
  BookOpen, Sparkles, ClipboardList, GlassWater, ReceiptText, LayoutGrid,
  Snowflake, Citrus, Scale, ListChecks, HandHeart,
  Croissant, Sprout, TriangleAlert, ChefHat, Shirt,
  type LucideIcon,
} from 'lucide-react'
import { stagger, fadeUp, fullPanel, btnPrimary, btnCard, btnIcon } from '../animations/variants'
import { useMediaMode } from '../theme/MediaModeContext'
import { WaiterFigure, WaiterVideo, WaterScene, BreadScene } from './service/SceneSkins'

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelView = 'home' | 'waiter' | 'water' | 'bill' | 'split' | 'more' | 'jain' | 'bread'

const TIP_OPTIONS = [0, 5, 10, 15] as const

interface FeedItem {
  id: string
  label: string
  status: 'done' | 'pending' | 'queued'
  eta: string
}

interface ServicePanelProps {
  open: boolean
  onClose: () => void
  onRecommend?: () => void
  onOpenMenu?: () => void
  onViewOrder?: () => void
  orderCount: number
  total: number
}

// ─── Static data ─────────────────────────────────────────────────────────────

const JAIN_INFO = [
  { q: 'What is Jain food?', a: 'Jain cuisine avoids root vegetables (onion, garlic, potato, carrot, radish) and any ingredient that harms living organisms.' },
  { q: 'Which items are fully Jain?', a: 'Items marked with the Jain badge are prepared without any root vegetables. Look for the green "Jain" badge on the menu.' },
  { q: 'Can dishes be made Jain?', a: 'Many dishes show "Can be Jain" — these can be prepared Jain-friendly on request. Please inform your waiter before ordering.' },
  { q: 'Cross-contamination?', a: 'Our kitchen takes care with Jain orders, but we use a shared kitchen. Please speak to the waiter for strict requirements.' },
]

const WATER_OPTIONS: { id: string; label: string; sub: string; icon: LucideIcon }[] = [
  { id: 'still',     label: 'Still',      sub: 'spring, room temp', icon: GlassWater },
  { id: 'sparkling', label: 'Sparkling',  sub: 'well chilled',      icon: Sparkles },
  { id: 'ice',       label: '+ Ice',      sub: 'extra cubes',       icon: Snowflake },
  { id: 'lemon',     label: '+ Lemon',    sub: 'fresh wedge',       icon: Citrus },
]

const BILL_OPTIONS: { id: string; label: string; sub: string; icon: LucideIcon }[] = [
  { id: 'whole',     label: 'One bill',     sub: 'for the table',  icon: ReceiptText },
  { id: 'split',     label: 'Split evenly', sub: '2 ways',         icon: Scale },
  { id: 'itemize',   label: 'Itemise',      sub: 'per dish',       icon: ListChecks },
  { id: 'gratuity',  label: 'Add gratuity', sub: '10 / 18 / 20%',  icon: HandHeart },
]

const MORE_OPTIONS: { id: string; label: string; sub: string; icon: LucideIcon; action: string }[] = [
  { id: 'bread',      label: 'Bread basket',     sub: 'warm sourdough',    icon: Croissant,     action: 'bread' },
  { id: 'jain',       label: 'Jain info',        sub: 'menu details',      icon: Sprout,        action: 'jain' },
  { id: 'allergy',    label: 'Allergy note',     sub: 'flag the kitchen',  icon: TriangleAlert, action: 'send' },
  { id: 'compliment', label: 'Compliments',      sub: 'to the chef',       icon: ChefHat,       action: 'send' },
  { id: 'choose',     label: 'Help choosing',    sub: 'ask our team',      icon: Sparkles,      action: 'send' },
  { id: 'coat',       label: 'Coat check',       sub: 'retrieve',          icon: Shirt,         action: 'send' },
]

const SEED_FEED: FeedItem[] = [
  { id: 'seed-1', label: 'Table seated',      status: 'done',    eta: '— done' },
  { id: 'seed-2', label: 'Menus delivered',   status: 'done',    eta: '— done' },
]

const TOAST_MESSAGES: Record<string, string> = {
  still:     'Still water, on its way.',
  sparkling: 'Sparkling, well chilled.',
  ice:       'Extra ice — coming.',
  lemon:     'A wedge of lemon — coming.',
  whole:     'One bill, on its way.',
  split:     'Bill split — sent to your waiter.',
  itemize:   'Itemising the bill.',
  gratuity:  'Add gratuity at the till.',
  bread:     'More bread — coming.',
  allergy:   'Kitchen flagged. Waiter will confirm.',
  compliment:'Compliments passed to the kitchen.',
  choose:    'Waiter will be with you shortly.',
  coat:      'Retrieving your coats.',
  waiter:    'Waiter has been called!',
  cancel:    'Cancelled — no waiter on the way.',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServicePanel({ open, onClose, onRecommend, onOpenMenu, onViewOrder, orderCount, total }: ServicePanelProps) {
  const { posterOnly } = useMediaMode()
  const [view, setView] = useState<PanelView>('home')
  const [feed, setFeed] = useState<FeedItem[]>(SEED_FEED)
  const [toastText, setToastText] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [eta, setEta] = useState(42)
  const [waterAnimKey, setWaterAnimKey] = useState(0)
  const [waiterArrived, setWaiterArrived] = useState(false)
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  // Split-bill calculator state
  const [splitPeople, setSplitPeople] = useState(2)
  const [splitTipPct, setSplitTipPct] = useState<number>(0)
  const [splitRoundUp, setSplitRoundUp] = useState(false)
  const etaRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const waiterArrivedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waiterCallIdRef = useRef<string | null>(null)

  // Reset on open/close — also resets view on close so next open starts at home
  useEffect(() => {
    setView('home')
    if (open) setToastVisible(false)
  }, [open])

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current)
      if (waiterArrivedTimerRef.current) clearTimeout(waiterArrivedTimerRef.current)
      feedTimersRef.current.forEach(clearTimeout)
      feedTimersRef.current.clear()
    }
  }, [])

  // Waiter arrival — legs walk for 5.5s (approach duration) then stop
  useEffect(() => {
    if (view === 'waiter') {
      setWaiterArrived(false)
      waiterArrivedTimerRef.current = setTimeout(() => setWaiterArrived(true), 5500)
    }
    return () => {
      if (waiterArrivedTimerRef.current) clearTimeout(waiterArrivedTimerRef.current)
    }
  }, [view])

  // ETA countdown when waiter view is active
  useEffect(() => {
    if (view !== 'waiter') {
      if (etaRef.current) clearInterval(etaRef.current)
      return
    }
    setEta(42)
    // Capture id locally to avoid stale-ref inside the updater closure
    const id = setInterval(() => {
      setEta(prev => {
        if (prev <= 1) { clearInterval(id); return 0 }
        return prev - 1
      })
    }, 1000)
    etaRef.current = id
    return () => clearInterval(id)
  }, [view])

  const formatEta = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const addFeed = useCallback((label: string, feedEta: string) => {
    const id = `req-${Date.now()}`
    const item: FeedItem = { id, label, status: 'pending', eta: feedEta }
    setFeed(prev => [item, ...prev])
    const t = setTimeout(() => {
      setFeed(prev => prev.map(f => f.id === id ? { ...f, status: 'done', eta: '— done' } : f))
      feedTimersRef.current.delete(t)
    }, 4500)
    feedTimersRef.current.add(t)
    return id
  }, [])

  const showToast = useCallback((msg: string) => {
    setToastText(msg)
    setToastVisible(true)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToastVisible(false), 2400)
  }, [])

  const handleSend = useCallback((actionId: string, feedLabel: string, feedEta = '2 min') => {
    addFeed(feedLabel, feedEta)
    showToast(TOAST_MESSAGES[actionId] ?? 'Noted — on its way.')
    setView('home')
  }, [addFeed, showToast])

  const handleClose = () => {
    setView('home')
    onClose()
  }

  const handleCallWaiter = () => {
    setView('waiter')
    waiterCallIdRef.current = addFeed('Waiter called', '~45 sec')
  }

  const handleCancelWaiter = () => {
    showToast(TOAST_MESSAGES.cancel)
    const targetId = waiterCallIdRef.current
    setFeed(prev => prev.map(f => f.id === targetId && f.status === 'pending'
      ? { ...f, status: 'done', eta: '— cancelled' } : f))
    waiterCallIdRef.current = null
    setView('home')
  }

  const handleRippleTap = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const id = Date.now()
    setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 750)
    handleCallWaiter()
  }

  // Back-header helper — memoised so its reference stays stable across renders
  const backTo = useCallback((dest: PanelView) => (
    <motion.button
      whileTap={btnIcon.tap}
      onClick={() => setView(dest)}
      aria-label="Go back"
      className="w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
      style={{ background: 'rgba(139,16,36,0.08)' }}
    >
      <ChevronLeft size={16} aria-hidden="true" style={{ color: 'var(--maroon)' }} />
    </motion.button>
  ), [])

  // Time greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'good morning,' : hour < 17 ? 'good afternoon,' : 'good evening,'

  // ─── Waiter full-screen view ──────────────────────────────────────────────

  const waiterFullScreen = (
    <AnimatePresence>
      {open && view === 'waiter' && (
        <>
          {/* backdrop over whole app */}
          <motion.div
            key="waiter-bg"
            variants={fullPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[60]"
            style={{
              background: [
                'radial-gradient(60% 40% at 50% 100%, rgba(217,160,58,0.22), transparent 65%)',
                'radial-gradient(50% 40% at 20% 10%, rgba(255,248,234,0.9), transparent 70%)',
                'linear-gradient(180deg, var(--paper) 0%, #f0e4cc 100%)',
              ].join(', '),
            }}
          />

          {/* content — mirrors app-shell centering */}
          <motion.div
            key="waiter-content"
            variants={fullPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 bottom-0 z-[61] flex flex-col overflow-hidden w-full"
            style={{
              maxWidth: 560,
              left: '50%',
              transform: 'translateX(-50%)',
              right: 'auto',
            }}
          >
            {/* Full-bleed waiter video behind everything (video mode only), with a
                scrim: dark at the very top for the label, clear video in the middle,
                cream at the bottom so the copy + buttons keep their dark-on-cream design. */}
            {!posterOnly && (
              <div className="absolute inset-0" style={{ zIndex: 0 }}>
                <WaiterVideo />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to bottom, rgba(4,1,3,0.5) 0%, rgba(4,1,3,0) 12%, rgba(4,1,3,0) 32%, rgba(247,235,210,0.5) 44%, var(--paper) 58%, var(--paper) 100%)',
                  }}
                />
              </div>
            )}

            {/* top row */}
            <div className="flex items-center justify-between px-5 pt-14 pb-4" style={{ position: 'relative', zIndex: 1 }}>
              <p
                className="font-inter text-[10px] uppercase tracking-[0.28em]"
                style={{ color: posterOnly ? 'var(--mute)' : 'rgba(255,248,234,0.85)', textShadow: posterOnly ? 'none' : '0 1px 6px rgba(0,0,0,0.5)' }}
              >
                — Waiter en route —
              </p>
              <motion.button
                whileTap={btnIcon.tap}
                aria-label="Close"
                onClick={() => setView('home')}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,16,36,0.08)', border: '1px solid rgba(139,16,36,0.15)' }}
              >
                <X size={14} aria-hidden="true" style={{ color: 'var(--maroon)' }} />
              </motion.button>
            </div>

            {/* waiter figure area — animated SVG (image mode) or an empty spacer
                that lets the full-bleed background video show through (video mode). */}
            <div className="flex-1 relative overflow-hidden flex items-end justify-center" style={{ zIndex: 1 }}>
              {posterOnly && (
                <>
                  {/* subtle ground glow */}
                  <div
                    className="absolute bottom-0 left-1/2 pointer-events-none"
                    style={{
                      transform: 'translateX(-50%)',
                      width: '120%',
                      height: '45%',
                      background: 'radial-gradient(60% 80% at 50% 100%, rgba(217,160,58,0.18), transparent 70%)',
                    }}
                  />
                  {/* animated SVG figure — walks in then sways */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '5%',
                      width: 100,
                      height: 240,
                      animation: 'waiterApproach 5.5s cubic-bezier(0.4,0.05,0.5,1) forwards',
                    }}
                  >
                    <div style={{ width: '100%', height: '100%', animation: 'waiter-sway 0.65s ease-in-out infinite alternate', transformOrigin: '50% 100%' }}>
                      <WaiterFigure walking={!waiterArrived} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* copy */}
            <div className="text-center px-5 pt-2 pb-2" style={{ position: 'relative', zIndex: 1 }}>
              <div
                className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(79,122,60,0.1)', border: '1px solid rgba(79,122,60,0.28)' }}
              >
                <CheckCircle2 size={13} style={{ color: 'var(--olive)' }} />
                <span className="font-inter text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--olive)' }}>
                  Request received · Table 7
                </span>
              </div>
              <h2 className="font-playfair font-bold text-[26px] leading-tight" style={{ color: 'var(--ink)' }}>
                <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Your waiter is </span>on the way
              </h2>
              {/* ETA countdown ring */}
              <div className="flex flex-col items-center gap-1.5 mt-4">
                <div className="relative" style={{ width: 82, height: 82 }}>
                  <svg width={82} height={82} viewBox="0 0 82 82" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={41} cy={41} r={33} fill="none" stroke="rgba(217,160,58,0.15)" strokeWidth={4} />
                    <circle
                      cx={41} cy={41} r={33}
                      fill="none"
                      stroke={eta === 0 ? 'var(--olive)' : 'var(--gold)'}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 33}
                      strokeDashoffset={2 * Math.PI * 33 * (1 - eta / 42)}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                    <span className="font-inter text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--mute)' }}>ETA</span>
                    <span className="font-playfair font-bold text-[17px] leading-none" style={{ color: eta === 0 ? 'var(--olive)' : 'var(--maroon)' }}>
                      {eta === 0 ? '✓' : formatEta(eta)}
                    </span>
                  </div>
                </div>
                {eta === 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-inter text-[11px] uppercase tracking-[0.24em]"
                    style={{ color: 'var(--olive)' }}
                  >
                    Arrived!
                  </motion.p>
                )}
              </div>
            </div>

            {/* action buttons */}
            <div className="flex gap-3 px-5 pb-10 pt-3 justify-center flex-wrap" style={{ position: 'relative', zIndex: 1 }}>
              <motion.button
                whileTap={btnPrimary.tap}
                onClick={() => setView('home')}
                className="px-6 py-2.5 rounded-full font-inter text-[11px] uppercase tracking-[0.26em]"
                style={{ background: 'rgba(42,30,30,0.08)', border: '1px solid rgba(42,30,30,0.2)', color: 'var(--ink)' }}
              >
                Hide
              </motion.button>
              <motion.button
                whileTap={btnPrimary.tap}
                onClick={handleCancelWaiter}
                className="px-6 py-2.5 rounded-full font-inter text-[11px] uppercase tracking-[0.26em]"
                style={{ background: 'rgba(215,25,32,0.06)', border: '1px solid rgba(215,25,32,0.22)', color: 'var(--red)' }}
              >
                Cancel request
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  // ─── Bottom sheet (all other views) ──────────────────────────────────────
  // Always mounted; animates on `sheetOpen`. This avoids the StrictMode +
  // AnimatePresence mount-race that left the sheet stuck off-screen at y:100%.
  const sheetOpen = open && view !== 'waiter'

  return (
    <>
      {waiterFullScreen}

      {/* Backdrop — always mounted; fades on sheetOpen */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(42,30,30,0.48)', pointerEvents: sheetOpen ? 'auto' : 'none' }}
        initial={false}
        animate={{ opacity: sheetOpen ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onClick={handleClose}
        aria-hidden={!sheetOpen}
      />

      {/* Panel — always mounted; slides on sheetOpen */}
      <motion.div
        initial={false}
        animate={{ y: sheetOpen ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[480px] sm:max-w-[560px] z-50 rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--paper)',
          boxShadow: 'var(--shadow-sheet)',
          maxHeight: '88dvh',
          pointerEvents: sheetOpen ? 'auto' : 'none',
        }}
      >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--mute)', opacity: 0.4 }} />
              </div>

              {/* Header */}
              <div
                className="flex items-center px-5 pt-1 pb-3 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(217,160,58,0.18)' }}
              >
                {/* Back button for sub-views */}
                {(view === 'water' || view === 'bill' || view === 'split' || view === 'more' || view === 'jain' || view === 'bread') &&
                  backTo(view === 'jain' ? 'more' : view === 'bread' ? 'more' : view === 'split' ? 'bill' : 'home')}

                {/* Bell icon for home */}
                {view === 'home' && (
                  <div className="mr-3 flex-shrink-0">
                    <Bell size={18} style={{ color: 'var(--gold)' }} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-playfair font-bold text-[17px]" style={{ color: 'var(--maroon)' }}>
                    {view === 'home'  && 'Table Service'}
                    {view === 'water' && 'Request Water'}
                    {view === 'bill'  && 'Bill'}
                    {view === 'split' && 'Split the Bill'}
                    {view === 'more'  && 'More Options'}
                    {view === 'jain'  && 'Jain Menu Details'}
                    {view === 'bread' && 'Bread & Sourdough'}
                  </h3>
                  {view === 'home' && (
                    <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                      How can we help you?
                    </p>
                  )}
                </div>

                <motion.button
                  whileTap={btnIcon.tap}
                  aria-label="Close"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center ml-2 flex-shrink-0"
                  style={{ background: 'rgba(139,16,36,0.08)' }}
                >
                  <X size={15} aria-hidden="true" style={{ color: 'var(--maroon)' }} />
                </motion.button>
              </div>

              {/* Scrollable body — keyed crossfade; the active view is keyed so
                  switching unmounts the old instantly (no mode="wait" stall) and
                  fades the new one in. */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <AnimatePresence>

                  {/* ── HOME ─────────────────────────────────────────────────── */}
                  {view === 'home' && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-5 pt-4 pb-6"
                    >
                      {/* Table tag */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: 'var(--gold)',
                            boxShadow: '0 0 8px var(--gold)',
                            animation: 'status-blink 1.6s ease-in-out infinite',
                          }}
                        />
                        <span className="font-inter text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--mute)' }}>
                          Table 7 · 2 guests
                        </span>
                      </div>

                      {/* Greeting */}
                      <p className="font-playfair text-[18px] mb-1" style={{ color: 'var(--ink-soft)', fontStyle: 'italic', fontWeight: 300 }}>
                        {greeting}
                      </p>
                      <p className="font-playfair font-bold text-[22px] mb-4 leading-tight" style={{ color: 'var(--ink)' }}>
                        Welcome to Relish
                      </p>

                      {/* Hero "Call Waiter" button */}
                      <motion.button
                        whileTap={btnPrimary.tap}
                        onClick={handleRippleTap}
                        className="w-full rounded-2xl p-4 mb-5 text-left overflow-hidden relative"
                        style={{
                          background: 'linear-gradient(160deg, #A52030 0%, #7A0E1E 55%, #5c0a15 100%)',
                          color: '#FFF8EA',
                          animation: 'pulse-glow 2.8s ease-in-out infinite',
                        }}
                      >
                        {/* shimmer */}
                        <span
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.12) 50%, transparent 80%)',
                            animation: 'shine-sweep 4s ease-in-out 1s infinite',
                          }}
                        />
                        {/* glow orb */}
                        <span
                          className="absolute pointer-events-none"
                          style={{
                            right: -24, top: -24, width: 120, height: 120,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(217,160,58,0.35), transparent 65%)',
                          }}
                        />
                        {/* tap ripples */}
                        {ripples.map(r => (
                          <span
                            key={r.id}
                            className="absolute pointer-events-none rounded-full"
                            style={{
                              left: r.x,
                              top: r.y,
                              transform: 'translate(-50%, -50%)',
                              background: 'rgba(255,248,234,0.28)',
                              animation: 'ripple-wave 0.75s ease-out forwards',
                            }}
                          />
                        ))}
                        <div className="flex items-center gap-3 relative">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,248,234,0.14)', border: '1px solid rgba(255,248,234,0.2)' }}
                          >
                            <Bell size={22} style={{ color: '#FFF8EA' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-inter text-[10px] uppercase tracking-[0.3em] mb-0.5" style={{ color: 'rgba(255,248,234,0.65)' }}>
                              Anytime
                            </p>
                            <p className="font-playfair font-bold text-[20px] leading-tight" style={{ color: '#FFF8EA' }}>
                              Call our waiter
                            </p>
                          </div>
                          <ChevronRight size={22} strokeWidth={2} style={{ color: 'rgba(255,248,234,0.55)' }} />
                        </div>
                      </motion.button>

                      {/* Grid label */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-inter text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--mute)' }}>
                          At Your Service
                        </p>
                        <p className="font-inter text-[10px]" style={{ color: 'var(--mute)', opacity: 0.6 }}>tap any</p>
                      </div>

                      {/* 3×2 action grid */}
                      <motion.div
                        variants={stagger}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-3 gap-2 mb-5"
                      >
                        {/* Menu */}
                        <ActionCard
                          icon={BookOpen} label="Menu" sub="browse"
                          onClick={() => { onOpenMenu?.(); handleClose() }}
                        />
                        {/* Ask AI */}
                        <ActionCard
                          icon={Sparkles} label="Ask AI" sub="Relish guide"
                          badge="AI"
                          onClick={() => { onRecommend?.(); handleClose() }}
                        />
                        {/* My Order */}
                        <ActionCard
                          icon={ClipboardList} label="My Order" sub={orderCount > 0 ? `${orderCount} item${orderCount !== 1 ? 's' : ''} · ₹${total.toLocaleString('en-IN')}` : 'empty'}
                          onClick={() => { onViewOrder?.(); handleClose() }}
                        />
                        {/* Water */}
                        <ActionCard
                          icon={GlassWater} label="Water" sub="still · sparkling"
                          onClick={() => { setWaterAnimKey(k => k + 1); setView('water') }}
                        />
                        {/* Bill */}
                        <ActionCard
                          icon={ReceiptText} label="Bill" sub="split · pay"
                          onClick={() => setView('bill')}
                        />
                        {/* More */}
                        <ActionCard
                          icon={LayoutGrid} label="More" sub="jain · etc"
                          onClick={() => setView('more')}
                        />
                      </motion.div>

                      {/* Live requests feed */}
                      {feed.length > 0 && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-inter text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--mute)' }}>
                              Tonight's requests
                            </p>
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: 'var(--gold)', animation: 'status-blink 1.8s ease-in-out infinite' }}
                            />
                          </div>
                          <div
                            className="rounded-2xl overflow-hidden"
                            style={{ border: '1px solid rgba(217,160,58,0.18)', background: 'rgba(217,160,58,0.04)' }}
                          >
                            {feed.slice(0, 5).map((item, i) => (
                              <FeedRow key={item.id} item={item} last={i === Math.min(feed.length, 5) - 1} />
                            ))}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* ── WATER ────────────────────────────────────────────────── */}
                  {view === 'water' && (
                    <motion.div
                      key="water"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pt-4 pb-8"
                    >
                      <WaterScene animKey={waterAnimKey} posterOnly={posterOnly} />
                      <div className="grid grid-cols-2 gap-2.5">
                        {WATER_OPTIONS.map(opt => (
                          <OptionCard
                            key={opt.id}
                            icon={opt.icon}
                            label={opt.label}
                            sub={opt.sub}
                            onClick={() => handleSend(opt.id, `Water — ${opt.label}`, '~2 min')}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── BREAD / SOURDOUGH ────────────────────────────────────── */}
                  {view === 'bread' && (
                    <motion.div
                      key="bread"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pt-4 pb-8"
                    >
                      <BreadScene posterOnly={posterOnly} />
                      <div className="grid grid-cols-2 gap-2.5">
                        <OptionCard
                          icon={Croissant}
                          label="Sourdough"
                          sub="warm basket"
                          onClick={() => handleSend('bread', 'Bread — sourdough', '~2 min')}
                        />
                        <OptionCard
                          icon={Croissant}
                          label="More bread"
                          sub="refill please"
                          onClick={() => handleSend('bread', 'Bread — refill', '~2 min')}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ── BILL ─────────────────────────────────────────────────── */}
                  {view === 'bill' && (
                    <motion.div
                      key="bill"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pt-4 pb-8"
                    >
                      <p
                        className="font-playfair italic text-[15px] mb-4 leading-snug"
                        style={{ color: 'var(--ink-soft)' }}
                      >
                        We'll print &amp; bring it over. No rush.
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {BILL_OPTIONS.map(opt => (
                          <OptionCard
                            key={opt.id}
                            icon={opt.icon}
                            label={opt.label}
                            sub={opt.id === 'split' ? 'calculate shares' : opt.sub}
                            onClick={() =>
                              opt.id === 'split'
                                ? setView('split')
                                : handleSend(opt.id, `Bill — ${opt.label}`, '~3 min')
                            }
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── SPLIT BILL (share calculator) ────────────────────────── */}
                  {view === 'split' && (
                    <motion.div
                      key="split"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pt-4 pb-8"
                    >
                      {total <= 0 ? (
                        /* Empty-order guard */
                        <div className="flex flex-col items-center text-center py-8 gap-3">
                          <span className="text-3xl">🧮</span>
                          <p className="font-playfair font-bold text-[17px]" style={{ color: 'var(--ink)' }}>
                            Nothing to split yet
                          </p>
                          <p className="font-inter text-[12px] leading-relaxed max-w-[230px]" style={{ color: 'var(--ink-soft)' }}>
                            Add a few dishes to your order and we'll work out everyone's share.
                          </p>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { onOpenMenu?.(); handleClose() }}
                            className="mt-1 px-5 py-2.5 rounded-full font-inter font-semibold text-[12px]"
                            style={{ background: 'rgba(139,16,36,0.1)', color: 'var(--maroon)', border: '1px solid rgba(139,16,36,0.25)' }}
                          >
                            Browse the menu
                          </motion.button>
                        </div>
                      ) : (
                        (() => {
                          // ── Share math (defined rounding → no floating-point garbage) ──
                          const subtotal = total
                          const baseTip = Math.round((subtotal * splitTipPct) / 100)
                          const grand = subtotal + baseTip
                          const rawPer = grand / splitPeople
                          const perPerson = splitRoundUp ? Math.ceil(rawPer / 10) * 10 : Math.ceil(rawPer)
                          const collected = perPerson * splitPeople
                          const tipTotal = collected - subtotal // baseTip + rounding overage
                          const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

                          return (
                            <>
                              {/* Per-person hero */}
                              <div
                                className="rounded-2xl px-4 py-5 mb-4 text-center relative overflow-hidden"
                                style={{ background: 'rgba(139,16,36,0.06)', border: '1px solid rgba(139,16,36,0.18)' }}
                              >
                                <p className="font-inter text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: 'var(--mute)' }}>
                                  Each person pays
                                </p>
                                <p className="font-playfair font-bold leading-none" style={{ fontSize: 40, color: 'var(--maroon)' }}>
                                  {inr(perPerson)}
                                </p>
                                <p className="font-inter text-[11px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
                                  {splitPeople} {splitPeople === 1 ? 'person' : 'people'} · {inr(collected)} total
                                </p>
                              </div>

                              {/* People stepper */}
                              <div className="flex items-center justify-between mb-4">
                                <span className="font-inter text-[12px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-soft)' }}>
                                  Split between
                                </span>
                                <div className="flex items-center gap-3">
                                  <StepBtn label="Decrease" disabled={splitPeople <= 1} onClick={() => setSplitPeople(p => Math.max(1, p - 1))}>−</StepBtn>
                                  <span className="font-playfair font-bold text-[20px] w-7 text-center" style={{ color: 'var(--ink)' }}>
                                    {splitPeople}
                                  </span>
                                  <StepBtn label="Increase" disabled={splitPeople >= 20} onClick={() => setSplitPeople(p => Math.min(20, p + 1))}>+</StepBtn>
                                </div>
                              </div>

                              {/* Gratuity chips */}
                              <p className="font-inter text-[12px] uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--ink-soft)' }}>
                                Add a tip
                              </p>
                              <div className="grid grid-cols-4 gap-2 mb-4">
                                {TIP_OPTIONS.map(pct => {
                                  const active = splitTipPct === pct
                                  return (
                                    <motion.button
                                      key={pct}
                                      whileTap={{ scale: 0.94 }}
                                      onClick={() => setSplitTipPct(pct)}
                                      aria-pressed={active}
                                      className="py-2.5 rounded-xl font-inter font-semibold text-[13px]"
                                      style={{
                                        background: active ? 'var(--maroon)' : 'rgba(42,30,30,0.04)',
                                        border: active ? '1px solid var(--maroon)' : '1px solid rgba(42,30,30,0.12)',
                                        color: active ? '#FFF8EA' : 'var(--ink-soft)',
                                      }}
                                    >
                                      {pct === 0 ? 'None' : `${pct}%`}
                                    </motion.button>
                                  )
                                })}
                              </div>

                              {/* Round-up toggle */}
                              <button
                                onClick={() => setSplitRoundUp(r => !r)}
                                aria-pressed={splitRoundUp}
                                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl mb-4"
                                style={{ background: 'rgba(217,160,58,0.07)', border: '1px solid rgba(217,160,58,0.22)' }}
                              >
                                <span className="flex flex-col text-left">
                                  <span className="font-inter font-semibold text-[12.5px]" style={{ color: 'var(--ink)' }}>
                                    Round up for the staff
                                  </span>
                                  <span className="font-inter text-[10px]" style={{ color: 'var(--mute)' }}>
                                    nearest ₹10 each · extra goes to tip
                                  </span>
                                </span>
                                <span
                                  className="relative flex-shrink-0 rounded-full transition-colors"
                                  style={{ width: 40, height: 24, background: splitRoundUp ? 'var(--olive)' : 'rgba(42,30,30,0.18)' }}
                                >
                                  <motion.span
                                    layout
                                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                    className="absolute top-0.5 rounded-full bg-white"
                                    style={{ width: 20, height: 20, left: splitRoundUp ? 18 : 2 }}
                                  />
                                </span>
                              </button>

                              {/* Breakdown */}
                              <div
                                className="rounded-2xl overflow-hidden mb-5"
                                style={{ border: '1px solid rgba(42,30,30,0.1)' }}
                              >
                                <BreakRow label="Order subtotal" value={inr(subtotal)} />
                                <BreakRow label={`Tip${splitTipPct > 0 ? ` · ${splitTipPct}%` : ''}`} value={inr(tipTotal)} />
                                <BreakRow label="Table total" value={inr(collected)} strong />
                              </div>

                              {/* CTA */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleSend('split', `Bill — split ${splitPeople} ways · ${inr(perPerson)}/person`, '~3 min')}
                                className="w-full py-3.5 rounded-full font-inter font-semibold text-[13.5px]"
                                style={{ background: 'linear-gradient(135deg, #A52030, #7A0E1E)', color: '#FFF8EA', boxShadow: '0 4px 16px rgba(139,16,36,0.28)' }}
                              >
                                Ask for the bill — split {splitPeople} ways
                              </motion.button>
                            </>
                          )
                        })()
                      )}
                    </motion.div>
                  )}

                  {/* ── MORE ─────────────────────────────────────────────────── */}
                  {view === 'more' && (
                    <motion.div
                      key="more"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pt-4 pb-8"
                    >
                      <div className="grid grid-cols-2 gap-2.5">
                        {MORE_OPTIONS.map(opt => (
                          <OptionCard
                            key={opt.id}
                            icon={opt.icon}
                            label={opt.label}
                            sub={opt.sub}
                            onClick={() => {
                              if (opt.action === 'jain') {
                                setView('jain')
                              } else if (opt.action === 'bread') {
                                setView('bread')
                              } else {
                                handleSend(opt.id, opt.label, '~2 min')
                              }
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── JAIN INFO ────────────────────────────────────────────── */}
                  {view === 'jain' && (
                    <motion.div
                      key="jain"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="px-5 pt-4 pb-8 flex flex-col gap-4"
                    >
                      {/* Badge header */}
                      <div
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'rgba(79,122,60,0.08)', border: '1px solid rgba(79,122,60,0.25)' }}
                      >
                        <span className="text-2xl">🌿</span>
                        <div>
                          <p className="font-playfair font-semibold text-[14px]" style={{ color: 'var(--olive)' }}>
                            Jain-Friendly Options Available
                          </p>
                          <p className="font-inter text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                            Always inform your waiter before ordering
                          </p>
                        </div>
                      </div>

                      {JAIN_INFO.map((item, i) => (
                        <motion.div
                          key={item.q}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex flex-col gap-1"
                        >
                          <p className="font-inter font-semibold text-[13px]" style={{ color: 'var(--maroon)' }}>
                            {item.q}
                          </p>
                          <p className="font-inter text-[12px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                            {item.a}
                          </p>
                          {i < JAIN_INFO.length - 1 && <div className="gold-divider mt-1" />}
                        </motion.div>
                      ))}

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          handleSend('jain-waiter', 'Jain query — waiter coming', '~2 min')
                        }}
                        className="w-full py-3 rounded-full font-inter font-semibold text-[13px] mt-2"
                        style={{ background: 'rgba(79,122,60,0.12)', color: 'var(--olive)', border: '1px solid rgba(79,122,60,0.3)' }}
                      >
                        Still have questions? Call waiter
                      </motion.button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* In-panel toast */}
              <AnimatePresence>
                {toastVisible && (
                  <motion.div
                    key="toast"
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="absolute bottom-4 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-2xl z-10"
                    style={{
                      background: 'var(--ink)',
                      boxShadow: '0 8px 32px rgba(42,30,30,0.22)',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ color: 'var(--olive)', flexShrink: 0 }} />
                    <p className="font-inter text-[12px]" style={{ color: '#FFF8EA' }}>{toastText}</p>
                  </motion.div>
                )}
              </AnimatePresence>

      </motion.div>
    </>
  )
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function ActionCard({ icon: Icon, label, sub, badge, onClick }: {
  icon: LucideIcon
  label: string
  sub: string
  badge?: string
  onClick: () => void
}) {
  return (
    <motion.button
      variants={fadeUp}
      whileTap={btnCard.tap}
      whileHover={btnCard.hover}
      onClick={onClick}
      className="relative flex flex-col gap-2 p-3 rounded-2xl text-left min-h-[96px] overflow-hidden cursor-pointer transition-colors duration-200"
      style={{
        background: 'rgba(217,160,58,0.07)',
        border: '1px solid rgba(217,160,58,0.22)',
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, background: 'rgba(217,160,58,0.12)', border: '1px solid rgba(217,160,58,0.22)' }}
      >
        <Icon size={19} strokeWidth={1.75} style={{ color: 'var(--gold)' }} />
      </span>
      <span className="font-playfair font-semibold text-[14px] leading-tight" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="font-inter text-[10px] mt-auto" style={{ color: 'var(--mute)' }}>
        {sub}
      </span>
      {badge && (
        <span
          className="absolute top-2 right-2 font-inter text-[9px] px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(217,160,58,0.18)', color: 'var(--gold)' }}
        >
          {badge}
        </span>
      )}
    </motion.button>
  )
}

function OptionCard({ icon: Icon, label, sub, onClick }: {
  icon: LucideIcon
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={btnCard.tap}
      whileHover={btnCard.hover}
      onClick={onClick}
      className="flex flex-col gap-2 p-3.5 rounded-2xl text-left min-h-[104px] cursor-pointer transition-colors duration-200"
      style={{
        background: 'rgba(42,30,30,0.04)',
        border: '1px solid rgba(42,30,30,0.12)',
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-xl"
        style={{ width: 40, height: 40, background: 'rgba(139,16,36,0.07)', border: '1px solid rgba(139,16,36,0.16)' }}
      >
        <Icon size={21} strokeWidth={1.75} style={{ color: 'var(--maroon)' }} />
      </span>
      <span className="font-playfair font-semibold text-[15px] leading-tight" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="font-inter text-[10px] mt-auto uppercase tracking-[0.2em]" style={{ color: 'var(--mute)' }}>
        {sub}
      </span>
    </motion.button>
  )
}

function StepBtn({ children, onClick, disabled, label }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center font-playfair text-[20px] leading-none flex-shrink-0"
      style={{
        background: disabled ? 'rgba(42,30,30,0.04)' : 'rgba(139,16,36,0.08)',
        border: `1px solid ${disabled ? 'rgba(42,30,30,0.1)' : 'rgba(139,16,36,0.22)'}`,
        color: disabled ? 'var(--mute)' : 'var(--maroon)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </motion.button>
  )
}

function BreakRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{
        background: strong ? 'rgba(139,16,36,0.05)' : 'transparent',
        borderTop: strong ? '1px solid rgba(42,30,30,0.1)' : 'none',
      }}
    >
      <span
        className="font-inter text-[12px]"
        style={{ color: strong ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: strong ? 600 : 400 }}
      >
        {label}
      </span>
      <span
        className="font-inter"
        style={{ fontSize: strong ? 15 : 12.5, fontWeight: strong ? 700 : 500, color: strong ? 'var(--maroon)' : 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}

function FeedRow({ item, last }: { item: FeedItem; last: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-2.5"
      style={{
        borderBottom: last ? 'none' : '1px dashed rgba(217,160,58,0.18)',
        animation: item.status === 'pending' ? 'feed-enter 0.35s ease both' : undefined,
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: item.status === 'done'
            ? 'var(--olive)'
            : item.status === 'pending'
            ? 'var(--gold)'
            : 'var(--mute)',
          boxShadow: item.status === 'pending' ? '0 0 6px var(--gold)' : undefined,
          animation: item.status === 'pending' ? 'status-blink 1.4s ease-in-out infinite' : undefined,
        }}
      />
      <span className="flex-1 font-inter text-[12px] truncate" style={{ color: 'var(--ink-soft)' }}>
        {item.label}
      </span>
      <span className="font-inter text-[10px] flex-shrink-0" style={{ color: 'var(--mute)' }}>
        {item.eta}
      </span>
    </div>
  )
}
