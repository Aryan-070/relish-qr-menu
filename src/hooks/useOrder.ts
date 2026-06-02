import { useState, useCallback, useMemo, useEffect } from 'react'
import { type MenuItem } from '../data/menu'
import {
  type SelectedModifier,
  selectionUnitPrice,
  selectionLabel,
  selectionKey,
} from '../data/modifiers'
import { type Combo, comboLineId } from '../data/combos'

export interface OrderItem {
  item: MenuItem
  quantity: number
  /** Selected priced modifiers for this line. */
  modifiers: SelectedModifier[]
  /** Base price + modifier deltas, for one unit. */
  unitPrice: number
  /** Display summary of the selection ('' when only base prep). */
  label: string
  note?: string
  /** Stable identity = item id + sorted modifier selection. */
  lineId: string
}

const CART_STORAGE_KEY = 'relish.cart.v1'

/** SSR-safe, parse-guarded read of the persisted cart. Returns [] on any failure. */
function loadStoredCart(): OrderItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as OrderItem[]
  } catch {
    return []
  }
}

export function useOrder() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(loadStoredCart)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(orderItems))
    } catch {
      // Storage unavailable (private mode / quota) — degrade silently.
    }
  }, [orderItems])

  const addItem = useCallback((item: MenuItem, modifiers: SelectedModifier[] = []) => {
    const lineId = selectionKey(item.id, modifiers)
    setOrderItems(prev => {
      const existing = prev.find(o => o.lineId === lineId)
      if (existing) {
        return prev.map(o => (o.lineId === lineId ? { ...o, quantity: o.quantity + 1 } : o))
      }
      return [
        ...prev,
        {
          item,
          quantity: 1,
          modifiers,
          unitPrice: selectionUnitPrice(item.price, modifiers),
          label: selectionLabel(modifiers),
          lineId,
        },
      ]
    })
  }, [])

  const addCombo = useCallback((combo: Combo) => {
    const lineId = comboLineId(combo.id)
    setOrderItems(prev => {
      const existing = prev.find(o => o.lineId === lineId)
      if (existing) {
        return prev.map(o => (o.lineId === lineId ? { ...o, quantity: o.quantity + 1 } : o))
      }
      // A combo rides on the same OrderItem shape via a synthetic MenuItem so
      // the order panel renders it like any other line (name + label + price).
      const comboItem: MenuItem = {
        id: lineId,
        name: combo.name,
        price: combo.comboPrice,
        description: '',
        isJain: false,
        canBeJain: false,
        tags: [],
        pairings: {},
        customizations: [],
      }
      return [
        ...prev,
        {
          item: comboItem,
          quantity: 1,
          modifiers: [],
          unitPrice: combo.comboPrice,
          label: combo.itemNames.join(' · '),
          lineId,
        },
      ]
    })
  }, [])

  const removeItem = useCallback((lineId: string) => {
    setOrderItems(prev => prev.filter(o => o.lineId !== lineId))
  }, [])

  const updateQuantity = useCallback((lineId: string, delta: number) => {
    setOrderItems(prev =>
      prev.map(o => (o.lineId === lineId ? { ...o, quantity: Math.max(1, o.quantity + delta) } : o)),
    )
  }, [])

  const updateNote = useCallback((lineId: string, note: string) => {
    setOrderItems(prev => prev.map(o => (o.lineId === lineId ? { ...o, note } : o)))
  }, [])

  const clear = useCallback(() => {
    setOrderItems([])
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY)
      } catch {
        // Storage unavailable — nothing to clear.
      }
    }
  }, [])

  const total = useMemo(
    () => orderItems.reduce((sum, o) => sum + o.unitPrice * o.quantity, 0),
    [orderItems],
  )
  const count = useMemo(() => orderItems.reduce((sum, o) => sum + o.quantity, 0), [orderItems])

  return useMemo(
    () => ({ orderItems, addItem, addCombo, removeItem, updateQuantity, updateNote, clear, total, count }),
    [orderItems, addItem, addCombo, removeItem, updateQuantity, updateNote, clear, total, count],
  )
}
