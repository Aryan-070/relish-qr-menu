/**
 * Menu data source for the consumer surface.
 *
 * The static `src/data/menu.ts` remains the default (used by /demo and as a
 * loading fallback). The root storefront wraps the tree in `MenuDataProvider`
 * with categories fetched from the backend public API, so the same components
 * render live, console-editable data — including prices. Components read via
 * `useMenuData()`, which falls back to the static export when no provider is
 * mounted, keeping every other surface working unchanged.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  categories as staticCategories,
  getCategoryById as staticGetCategoryById,
  getCategoryForItem as staticGetCategoryForItem,
  getItemById as staticGetItemById,
  type Category,
  type MenuItem,
} from './menu'

export interface MenuData {
  categories: Category[]
  getCategoryById: (id: string) => Category | undefined
  getCategoryForItem: (itemId: string) => string
  getItemById: (id: string) => MenuItem | undefined
}

const STATIC_MENU_DATA: MenuData = {
  categories: staticCategories,
  getCategoryById: staticGetCategoryById,
  getCategoryForItem: staticGetCategoryForItem,
  getItemById: staticGetItemById,
}

const Ctx = createContext<MenuData | null>(null)

/** Build a {@link MenuData} (with derived helpers) from a category list. */
export function buildMenuData(categories: Category[]): MenuData {
  const allItems = categories.flatMap((c) => c.items)
  return {
    categories,
    getCategoryById: (id) => categories.find((c) => c.id === id),
    getItemById: (id) => allItems.find((i) => i.id === id),
    getCategoryForItem: (itemId) =>
      categories.find((c) => c.items.some((i) => i.id === itemId))?.id ?? '',
  }
}

interface MenuDataProviderProps {
  categories: Category[]
  children: ReactNode
}

export function MenuDataProvider({ categories, children }: MenuDataProviderProps) {
  const value = useMemo(() => buildMenuData(categories), [categories])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Read the active menu data. Falls back to the static menu outside a provider. */
export function useMenuData(): MenuData {
  return useContext(Ctx) ?? STATIC_MENU_DATA
}
