import { useState, useCallback, useMemo } from 'react'
import { type MenuItem } from '../data/menu'

export interface OrderItem {
  item: MenuItem
  quantity: number
  customization: string
  note?: string
}

export function useOrder() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  const addItem = useCallback((item: MenuItem, customization = 'Regular') => {
    setOrderItems(prev => {
      const existing = prev.find(o => o.item.id === item.id && o.customization === customization)
      if (existing) {
        return prev.map(o =>
          o.item.id === item.id && o.customization === customization
            ? { ...o, quantity: o.quantity + 1 }
            : o,
        )
      }
      return [...prev, { item, quantity: 1, customization }]
    })
  }, [])

  const removeItem = useCallback((itemId: string, customization: string) => {
    setOrderItems(prev => prev.filter(o => !(o.item.id === itemId && o.customization === customization)))
  }, [])

  const updateQuantity = useCallback((itemId: string, customization: string, delta: number) => {
    setOrderItems(prev =>
      prev.map(o =>
        o.item.id === itemId && o.customization === customization
          ? { ...o, quantity: Math.max(1, o.quantity + delta) }
          : o,
      ),
    )
  }, [])

  const updateNote = useCallback((itemId: string, customization: string, note: string) => {
    setOrderItems(prev =>
      prev.map(o =>
        o.item.id === itemId && o.customization === customization
          ? { ...o, note }
          : o,
      ),
    )
  }, [])

  const total = useMemo(() => orderItems.reduce((sum, o) => sum + o.item.price * o.quantity, 0), [orderItems])
  const count = useMemo(() => orderItems.reduce((sum, o) => sum + o.quantity, 0), [orderItems])

  return useMemo(
    () => ({ orderItems, addItem, removeItem, updateQuantity, updateNote, total, count }),
    [orderItems, addItem, removeItem, updateQuantity, updateNote, total, count],
  )
}
