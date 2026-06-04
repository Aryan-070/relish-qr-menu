/**
 * Maps the local QSR cart to backend order lines for real submission.
 *
 * The cart keys plain lines by the static qsrMenu item id (== backend
 * ``code``); combo lines are keyed ``combo:<id>`` and expand to their component
 * items. Each line resolves to a backend ``MenuItem`` UUID via the public-menu
 * ``code → item`` map; anything unresolved or unavailable is counted as skipped
 * (the caller can surface that). Modifier selections ride along as a note in v1
 * — full backend modifier wiring lands with the menu-detail rewire.
 */
import { recommendationPaths } from '../../data/qsrMenu'
import type { OrderItem } from '../../hooks/useOrder'
import type { OrderLineInput } from '../../lib/api/dining'
import type { PublicMenuItem } from '../../lib/api/publicMenu'

const COMBO_PREFIX = 'combo:'
const COMBO_ITEM_IDS = new Map(recommendationPaths.map(p => [p.id, p.itemIds]))

export interface MappedOrder {
  lines: OrderLineInput[]
  /** Cart lines that could not be resolved to an available backend item. */
  skipped: number
}

function isOrderable(item: PublicMenuItem | undefined): item is PublicMenuItem {
  return Boolean(item && item.available && !item.sold_out)
}

export function cartToOrderLines(
  orderItems: readonly OrderItem[],
  byCode: Map<string, PublicMenuItem>,
): MappedOrder {
  const lines: OrderLineInput[] = []
  let skipped = 0

  for (const line of orderItems) {
    const id = line.item.id
    if (id.startsWith(COMBO_PREFIX)) {
      const componentIds = COMBO_ITEM_IDS.get(id.slice(COMBO_PREFIX.length)) ?? []
      const resolved = componentIds
        .map(code => byCode.get(code))
        .filter(isOrderable)
      if (resolved.length === 0) {
        skipped += 1
        continue
      }
      for (const backend of resolved) {
        lines.push({ menu_item_id: backend.id, qty: line.quantity })
      }
    } else {
      const backend = byCode.get(id)
      if (isOrderable(backend)) {
        lines.push({
          menu_item_id: backend.id,
          qty: line.quantity,
          note: line.label || undefined,
        })
      } else {
        skipped += 1
      }
    }
  }

  return { lines, skipped }
}
