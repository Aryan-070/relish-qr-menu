import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, CheckCircle2, Bell } from 'lucide-react'
import { bottomPanel, stagger, fadeUp, slideInRight, fullPanel } from '../animations/variants'

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelView = 'home' | 'waiter' | 'water' | 'bill' | 'more' | 'jain'

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

const WATER_OPTIONS = [
  { id: 'still',     label: 'Still',      sub: 'spring, room temp', icon: '💧' },
  { id: 'sparkling', label: 'Sparkling',  sub: 'well chilled',      icon: '✨' },
  { id: 'ice',       label: '+ Ice',      sub: 'extra cubes',       icon: '🧊' },
  { id: 'lemon',     label: '+ Lemon',    sub: 'fresh wedge',       icon: '🍋' },
] as const

const BILL_OPTIONS = [
  { id: 'whole',     label: 'One bill',     sub: 'for the table',  icon: '🧾' },
  { id: 'split',     label: 'Split evenly', sub: '2 ways',         icon: '⚖️' },
  { id: 'itemize',   label: 'Itemise',      sub: 'per dish',       icon: '📋' },
  { id: 'gratuity',  label: 'Add gratuity', sub: '10 / 18 / 20%',  icon: '🙏' },
] as const

const MORE_OPTIONS = [
  { id: 'bread',      label: 'Refill bread',     sub: 'sourdough',         icon: '🍞', action: 'send' },
  { id: 'jain',       label: 'Jain info',        sub: 'menu details',      icon: '🌿', action: 'jain' },
  { id: 'allergy',    label: 'Allergy note',     sub: 'flag the kitchen',  icon: '⚠️', action: 'send' },
  { id: 'compliment', label: 'Compliments',      sub: 'to the chef',       icon: '👨‍🍳', action: 'send' },
  { id: 'choose',     label: 'Help choosing',    sub: 'ask our team',      icon: '✦',  action: 'send' },
  { id: 'coat',       label: 'Coat check',       sub: 'retrieve',          icon: '🧥', action: 'send' },
] as const

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
  split:     'Splitting 2 ways.',
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

// ─── Sub-component: Waiter SVG silhouette ────────────────────────────────────

function WaiterFigure() {
  return (
    <svg viewBox="0 0 80 200" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* head */}
      <circle cx="40" cy="22" r="10" fill="var(--ink)" />
      {/* neck */}
      <rect x="36" y="30" width="8" height="6" fill="var(--ink)" />
      {/* shoulders + body */}
      <path d="M22 42 Q40 36 58 42 L60 90 Q40 96 20 90 Z" fill="var(--ink)" />
      {/* apron */}
      <path d="M26 60 Q40 64 54 60 L56 120 Q40 124 24 120 Z" fill="var(--ink-soft)" />
      <path d="M26 60 L24 56 L40 50 L56 56 L54 60" fill="var(--ink)" />
      {/* legs */}
      <path d="M28 118 L26 196 L36 196 L38 120 Z" fill="var(--ink)" />
      <path d="M42 120 L44 196 L54 196 L52 118 Z" fill="var(--ink)" />
      {/* left arm resting */}
      <path d="M22 42 Q14 60 18 90 L24 90 Q22 60 28 50 Z" fill="var(--ink)" />
      {/* right arm + tray */}
      <g style={{ transformOrigin: '54px 44px', animation: 'waiter-arm 0.65s ease-in-out infinite alternate' }}>
        <path d="M58 42 Q70 38 72 28 L66 24 Q60 32 54 40 Z" fill="var(--ink)" />
        {/* tray */}
        <ellipse cx="68" cy="22" rx="16" ry="3.5" fill="var(--ink-soft)" />
        <ellipse cx="68" cy="20.5" rx="16" ry="3" fill="var(--ink)" opacity="0.7" />
        {/* plate */}
        <ellipse cx="68" cy="18" rx="9" ry="2.4" fill="var(--maroon)" />
        <ellipse cx="68" cy="17.2" rx="6" ry="1.6" fill="var(--gold)" opacity="0.75" />
      </g>
    </svg>
  )
}

// ─── Sub-component: Water pour scene ─────────────────────────────────────────

function WaterPourScene({ animKey }: { animKey: number }) {
  const [full, setFull] = useState(false)
  const [poured, setPoured] = useState(false)

  useEffect(() => {
    setFull(false)
    setPoured(false)
    const t1 = setTimeout(() => setFull(true), 250)
    const t2 = setTimeout(() => setPoured(true), 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [animKey])

  return (
    <div
      className="relative flex items-end justify-center rounded-2xl overflow-hidden mb-4"
      style={{ height: 160, background: 'rgba(217,160,58,0.05)', border: '1px solid rgba(217,160,58,0.18)' }}
    >
      <div className="relative" style={{ width: 72, height: 120, marginBottom: 12 }}>
        {/* pour stream */}
        {!poured && (
          <div
            className="absolute left-1/2"
            style={{
              width: 5,
              top: -32,
              background: 'linear-gradient(180deg, rgba(180,215,230,0.95), rgba(120,180,210,0.5))',
              borderRadius: 3,
              transformOrigin: 'top center',
              animation: 'water-pour-stream 1.7s ease-out forwards',
              animationDelay: '0.15s',
            }}
          />
        )}
        {/* glass body */}
        <div
          className="absolute inset-0 rounded-b-xl overflow-hidden"
          style={{
            border: '2px solid rgba(42,30,30,0.35)',
            borderTop: 'none',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(42,30,30,0.04))',
          }}
        >
          {/* water fill */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: full ? '76%' : '0%',
              transition: 'height 1.5s cubic-bezier(0.4,0.05,0.5,1)',
              background: 'linear-gradient(180deg, rgba(180,215,230,0.82), rgba(120,180,210,0.95))',
            }}
          >
            {/* meniscus */}
            <div
              style={{
                position: 'absolute',
                left: -2,
                right: -2,
                top: -3,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(220,240,250,0.72)',
              }}
            />
          </div>
        </div>
      </div>
      {/* label */}
      <p
        className="absolute bottom-2 left-0 right-0 text-center font-inter text-[10px] uppercase tracking-widest"
        style={{ color: 'var(--mute)' }}
      >
        {poured ? 'Choose your preference' : 'Pouring…'}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServicePanel({ open, onClose, onRecommend, onOpenMenu, onViewOrder, orderCount }: ServicePanelProps) {
  const [view, setView] = useState<PanelView>('home')
  const [feed, setFeed] = useState<FeedItem[]>(SEED_FEED)
  const [toastText, setToastText] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [eta, setEta] = useState(42)
  const [waterAnimKey, setWaterAnimKey] = useState(0)
  const etaRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
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
      feedTimersRef.current.forEach(clearTimeout)
      feedTimersRef.current.clear()
    }
  }, [])

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

  // Back-header helper — memoised so its reference stays stable across renders
  const backTo = useCallback((dest: PanelView) => (
    <motion.button
      whileTap={{ scale: 0.88 }}
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
              maxWidth: 430,
              left: '50%',
              transform: 'translateX(-50%)',
              right: 'auto',
            }}
          >
            {/* top row */}
            <div className="flex items-center justify-between px-5 pt-14 pb-4">
              <p className="font-inter text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--mute)' }}>
                — Waiter en route —
              </p>
              <button
                aria-label="Close"
                onClick={() => setView('home')}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,16,36,0.08)', border: '1px solid rgba(139,16,36,0.15)' }}
              >
                <X size={14} aria-hidden="true" style={{ color: 'var(--maroon)' }} />
              </button>
            </div>

            {/* waiter figure area */}
            <div className="flex-1 relative overflow-hidden flex items-end justify-center">
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
              {/* figure */}
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
                  <WaiterFigure />
                </div>
              </div>
            </div>

            {/* copy */}
            <div className="text-center px-5 pt-2 pb-2">
              <p className="font-inter text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--mute)' }}>
                Notified just now
              </p>
              <h2 className="font-playfair font-bold text-[26px] leading-tight" style={{ color: 'var(--ink)' }}>
                <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Your waiter is </span>on the way
              </h2>
              {/* ETA pill */}
              <div
                className="inline-flex items-center gap-3 mt-4 px-5 py-2.5 rounded-full font-inter text-[11px] uppercase tracking-[0.28em]"
                style={{
                  background: 'rgba(217,160,58,0.1)',
                  border: '1px solid rgba(217,160,58,0.32)',
                  color: 'var(--ink)',
                }}
              >
                <span>ETA</span>
                <span className="font-bold" style={{ color: eta === 0 ? 'var(--olive)' : 'var(--maroon)' }}>
                  {eta === 0 ? 'here now' : formatEta(eta)}
                </span>
              </div>
            </div>

            {/* action buttons */}
            <div className="flex gap-3 px-5 pb-10 pt-3 justify-center flex-wrap">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('home')}
                className="px-6 py-2.5 rounded-full font-inter text-[11px] uppercase tracking-[0.26em]"
                style={{ background: 'rgba(42,30,30,0.08)', border: '1px solid rgba(42,30,30,0.2)', color: 'var(--ink)' }}
              >
                Hide
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
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

  return (
    <>
      {waiterFullScreen}

      <AnimatePresence>
        {open && view !== 'waiter' && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sp-backdrop"
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(42,30,30,0.48)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            {/* Panel */}
            <motion.div
              key="sp-panel"
              variants={bottomPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden flex flex-col"
              style={{
                background: 'var(--paper)',
                boxShadow: 'var(--shadow-sheet)',
                maxHeight: '88dvh',
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
                {(view === 'water' || view === 'bill' || view === 'more' || view === 'jain') && backTo(view === 'jain' ? 'more' : 'home')}

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
                    {view === 'more'  && 'More Options'}
                    {view === 'jain'  && 'Jain Menu Details'}
                  </h3>
                  {view === 'home' && (
                    <p className="font-inter text-[11px]" style={{ color: 'var(--mute)' }}>
                      How can we help you?
                    </p>
                  )}
                </div>

                <button
                  aria-label="Close"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center ml-2 flex-shrink-0"
                  style={{ background: 'rgba(139,16,36,0.08)' }}
                >
                  <X size={15} aria-hidden="true" style={{ color: 'var(--maroon)' }} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <AnimatePresence mode="wait">

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
                        whileTap={{ scale: 0.97 }}
                        onClick={handleCallWaiter}
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
                          <span className="font-playfair text-[24px]" style={{ color: 'rgba(255,248,234,0.55)' }}>›</span>
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
                          icon="📖" label="Menu" sub="browse"
                          onClick={() => { onOpenMenu?.(); handleClose() }}
                        />
                        {/* Ask AI */}
                        <ActionCard
                          icon="✦" label="Ask AI" sub="Relish guide"
                          badge="AI"
                          onClick={() => { onRecommend?.(); handleClose() }}
                        />
                        {/* My Order */}
                        <ActionCard
                          icon="📋" label="My Order" sub={orderCount > 0 ? `${orderCount} item${orderCount !== 1 ? 's' : ''}` : 'empty'}
                          onClick={() => { onViewOrder?.(); handleClose() }}
                        />
                        {/* Water */}
                        <ActionCard
                          icon="💧" label="Water" sub="still · sparkling"
                          onClick={() => { setWaterAnimKey(k => k + 1); setView('water') }}
                        />
                        {/* Bill */}
                        <ActionCard
                          icon="🧾" label="Bill" sub="split · pay"
                          onClick={() => setView('bill')}
                        />
                        {/* More */}
                        <ActionCard
                          icon="···" label="More" sub="jain · etc"
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
                      variants={slideInRight}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="px-5 pt-4 pb-8"
                    >
                      <WaterPourScene animKey={waterAnimKey} />
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

                  {/* ── BILL ─────────────────────────────────────────────────── */}
                  {view === 'bill' && (
                    <motion.div
                      key="bill"
                      variants={slideInRight}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
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
                            sub={opt.sub}
                            onClick={() => handleSend(opt.id, `Bill — ${opt.label}`, '~3 min')}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── MORE ─────────────────────────────────────────────────── */}
                  {view === 'more' && (
                    <motion.div
                      key="more"
                      variants={slideInRight}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
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
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function ActionCard({ icon, label, sub, badge, onClick }: {
  icon: string
  label: string
  sub: string
  badge?: string
  onClick: () => void
}) {
  return (
    <motion.button
      variants={fadeUp}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative flex flex-col gap-2 p-3 rounded-2xl text-left min-h-[90px] overflow-hidden"
      style={{
        background: 'rgba(217,160,58,0.07)',
        border: '1px solid rgba(217,160,58,0.22)',
      }}
    >
      <span className="text-lg leading-none">{icon}</span>
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

function OptionCard({ icon, label, sub, onClick }: {
  icon: string
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col gap-2 p-3.5 rounded-2xl text-left min-h-[100px]"
      style={{
        background: 'rgba(42,30,30,0.04)',
        border: '1px solid rgba(42,30,30,0.12)',
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="font-playfair font-semibold text-[15px] leading-tight" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="font-inter text-[10px] mt-auto uppercase tracking-[0.2em]" style={{ color: 'var(--mute)' }}>
        {sub}
      </span>
    </motion.button>
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
