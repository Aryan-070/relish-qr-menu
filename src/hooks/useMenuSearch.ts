import { useEffect, useMemo, useState } from 'react'
import { type MenuItem } from '../data/menu'
import { useMenuData } from '../data/MenuDataContext'
import { matchesDietary, type DietaryTag } from '../data/dietary'

export interface MenuSearchResult {
  item: MenuItem
  categoryId: string
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

/** Lightweight token match: every query token must appear in the item's
 *  searchable text (name + description + tags + category). */
function textMatches(item: MenuItem, categoryId: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const hay = `${item.name} ${item.description} ${item.tags.join(' ')} ${categoryId}`.toLowerCase()
  return tokens.every(tok => hay.includes(tok))
}

export interface UseMenuSearchOptions {
  query: string
  filters: ReadonlySet<DietaryTag>
  /** Max spice level (0–3). Items hotter than this are excluded. undefined = no cap. */
  maxSpice?: number
  /** Debounce for the query, ms. */
  debounceMs?: number
}

export interface UseMenuSearchValue {
  results: MenuSearchResult[]
  total: number
  isFiltering: boolean
}

export function useMenuSearch({
  query,
  filters,
  maxSpice,
  debounceMs = 140,
}: UseMenuSearchOptions): UseMenuSearchValue {
  const { categories } = useMenuData()
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), debounceMs)
    return () => clearTimeout(handle)
  }, [query, debounceMs])

  const allItems = useMemo<MenuSearchResult[]>(
    () => categories.flatMap(c => c.items.map(item => ({ item, categoryId: c.id }))),
    [categories],
  )

  const results = useMemo(() => {
    const tokens = normalize(debounced).split(/\s+/).filter(Boolean)
    return allItems.filter(({ item, categoryId }) => {
      if (!textMatches(item, categoryId, tokens)) return false
      if (!matchesDietary(item, filters)) return false
      if (maxSpice !== undefined && (item.spiceLevel ?? 0) > maxSpice) return false
      return true
    })
  }, [allItems, debounced, filters, maxSpice])

  const isFiltering = normalize(debounced).length > 0 || filters.size > 0 || maxSpice !== undefined

  return { results, total: results.length, isFiltering }
}
