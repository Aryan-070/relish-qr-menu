// Keyless demo adapter for aggregator integrations.
//
// Simulates the round-trips a real UrbanPiper-style adapter would make against
// a live aggregator API — without any credentials, network calls, or SDK. Every
// method resolves successfully and reports the counts it "pushed", which is all
// a sales demo or a future console view needs to render a believable
// "Connected · last synced" experience.
//
// REAL-API SEAM (per method, below): replace each simulated body with the
// corresponding HTTP request. The factory signature and return shapes are
// already production-correct, so a real adapter is a drop-in swap.

import type {
  AggregatorAdapter,
  AggregatorId,
  ItemAvailability,
  MenuItemPushInput,
  PushMenuResult,
  SyncStockResult,
} from './types'

/**
 * Simulated network latency (ms) so demo UIs can show a spinner / optimistic
 * state. Kept small to stay snappy in a sales walkthrough.
 */
const SIMULATED_LATENCY_MS = 350

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Structured console signal for the demo. Uses console.info (not console.log)
 * so it reads as an integration trace rather than stray debug output, and so
 * lint rules that only forbid console.log stay happy.
 */
function logSync(label: string, action: string, detail: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(`[aggregator:${label}] ${action}`, detail)
}

/**
 * Build a keyless mock adapter for one aggregator.
 *
 * @param id    Stable platform identifier (used as the adapter id).
 * @param label Human-readable label shown in UI.
 */
export function makeMockAdapter(id: AggregatorId, label: string): AggregatorAdapter {
  return {
    id,
    label,

    async pushMenu(items: MenuItemPushInput[]): Promise<PushMenuResult> {
      // REAL-API SEAM: POST the catalogue to the aggregator's menu endpoint,
      // e.g. POST /v1/locations/{storeId}/menu with mapped categories/items/
      // modifiers/taxes, then return the accepted count from the response.
      await delay(SIMULATED_LATENCY_MS)
      const count = items.filter((item) => item.available).length
      logSync(label, 'pushMenu', { total: items.length, published: count })
      return { ok: true, count }
    },

    async ingestOrders(): Promise<unknown[]> {
      // REAL-API SEAM: pull new orders (GET /v1/orders?status=new) or drain a
      // webhook queue, then return the raw platform payloads for normalisation.
      // The keyless demo has no live channel, so it ingests nothing.
      await delay(SIMULATED_LATENCY_MS)
      logSync(label, 'ingestOrders', { ingested: 0 })
      return []
    },

    async syncStock(itemAvailability: ItemAvailability[]): Promise<SyncStockResult> {
      // REAL-API SEAM: PATCH item availability ("86" toggles) to the
      // aggregator, e.g. PATCH /v1/locations/{storeId}/items/availability with
      // the list of {itemId, available} changes.
      await delay(SIMULATED_LATENCY_MS)
      const inStock = itemAvailability.filter((entry) => entry.available).length
      const eightySixed = itemAvailability.length - inStock
      logSync(label, 'syncStock', { changed: itemAvailability.length, inStock, eightySixed })
      return { ok: true }
    },
  }
}
