/**
 * Maps the local QSR cart to backend order lines for real submission.
 *
 * Plain items and combos both resolve to a real backend ``MenuItem`` by
 * ``code``: plain items use the qsrMenu id, combos use ``combo:<id>`` (the cart
 * line id), seeded as a bundle item at the discounted price so the charged
 * price matches the shown one. Only **modified / build-your-own** lines are NOT
 * auto-submitted — their modifier deltas aren't resolved to backend modifier
 * ids yet, so they'd bill at the base price; those route to the server.
 */
import type { OrderItem } from '../../hooks/useOrder'
import type { OrderLineInput } from '../../lib/api/dining'
import type { PublicMenuItem } from '../../lib/api/publicMenu'

export interface MappedOrder {
  lines: OrderLineInput[]
  /** Modified/BYO lines that need the server (not auto-submitted). */
  routedToServer: number
  /** Lines whose item is unavailable / sold out / not on the backend. */
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
    // Modifier-bearing lines can't be priced correctly server-side yet.
    if (line.modifiers.length > 0) {
      routedToServer += 1
      continue
    }
    // Plain item (id == code) or combo (id == "combo:<id>" == code) resolve alike.
    const backend = byCode.get(line.item.id)
    if (isOrderable(backend)) {
      lines.push({ menu_item_id: backend.id, qty: line.quantity })
    } else {
      unavailable += 1
    }
  }

  return { lines, routedToServer, unavailable }
}
