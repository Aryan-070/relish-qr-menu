/**
 * Maps the local QSR cart to backend order lines for real submission.
 *
 * v1 only submits **plain, unmodified** items, each resolved to a real backend
 * ``MenuItem`` by ``code`` (== the static qsrMenu item id). Two cases are
 * deliberately NOT auto-submitted because the backend can't yet price them
 * correctly, and silently charging a different amount than the guest saw would
 * be wrong:
 *   - **combos** — the backend has no bundle-discount concept, so expanding to
 *     components would bill the à-la-carte sum (an overcharge vs the shown
 *     combo price);
 *   - **modified / build-your-own lines** — modifier price deltas aren't yet
 *     resolved to backend modifier ids, so they'd bill at the base price.
 * Both are returned as ``routedToServer`` so the UI can tell the guest to have
 * their server add them. (Tracked for the backend combo/modifier increment.)
 */
import type { OrderItem } from '../../hooks/useOrder'
import type { OrderLineInput } from '../../lib/api/dining'
import type { PublicMenuItem } from '../../lib/api/publicMenu'

const COMBO_PREFIX = 'combo:'

export interface MappedOrder {
  lines: OrderLineInput[]
  /** Lines that need the server (combos / modified items) — not auto-submitted. */
  routedToServer: number
  /** Plain lines whose item is unavailable / sold out / not on the backend. */
  unavailable: number
}

function isOrderable(item: PublicMenuItem | undefined): item is PublicMenuItem {
  return Boolean(item && item.available && !item.sold_out)
}

export function cartToOrderLines(
  orderItems: readonly OrderItem[],
  byCode: Map<string, PublicMenuItem>,
): MappedOrder {
  const lines: OrderLineInput[] = []
  let routedToServer = 0
  let unavailable = 0

  for (const line of orderItems) {
    // Combos and modifier-bearing lines can't be priced correctly yet.
    if (line.item.id.startsWith(COMBO_PREFIX) || line.modifiers.length > 0) {
      routedToServer += 1
      continue
    }
    const backend = byCode.get(line.item.id)
    if (isOrderable(backend)) {
      lines.push({ menu_item_id: backend.id, qty: line.quantity })
    } else {
      unavailable += 1
    }
  }

  return { lines, routedToServer, unavailable }
}
