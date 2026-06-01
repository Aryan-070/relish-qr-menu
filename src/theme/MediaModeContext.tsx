import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'

export type MediaMode = 'video' | 'image'

interface MediaModeCtx {
  mode: MediaMode
  setMode: (m: MediaMode) => void
  /** True when surfaces should render stills only: image mode, reduced-motion, or data-saver. */
  posterOnly: boolean
}

const Ctx = createContext<MediaModeCtx | null>(null)

const STORAGE_KEY = 'relish-media-mode'

function readStored(): MediaMode {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'video' || s === 'image') return s
  } catch {
    /* ignore */
  }
  return 'video' // video-first default (user choice)
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function dataSaver(): boolean {
  try {
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection
    return Boolean(conn?.saveData)
  } catch {
    return false
  }
}

export function MediaModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MediaMode>(readStored)
  // Read environment constraints once — these force stills regardless of mode.
  const [forced] = useState(() => reducedMotion() || dataSaver())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const value = useMemo<MediaModeCtx>(
    () => ({ mode, setMode, posterOnly: mode === 'image' || forced }),
    [mode, forced],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMediaMode(): MediaModeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMediaMode must be used within MediaModeProvider')
  return ctx
}
