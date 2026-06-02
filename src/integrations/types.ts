// Aggregator integration layer (UrbanPiper-style middleware seam).
//
// This module models the contract between Relish and third-party food-ordering
// aggregators (Zomato, Swiggy, Uber Eats, DoorDash). In production this is the
// classic "middleware" pattern popularised by UrbanPiper/Urbanpiper Atlas:
// one normalised menu/stock/order schema that fans out to each aggregator's
// own REST API + webhook surface.
//
// Everything here is intentionally framework-free and UI-free pure TypeScript
// so it can be unit-tested and consumed later by a console view. The default
// implementation (see mockAdapter.ts) is keyless and simulates the round-trips
// for demo / sales purposes — no network, no credentials.

/** The aggregators Relish can publish to. */
export type AggregatorId = 'zomato' | 'swiggy' | 'ubereats' | 'doordash'

/**
 * Minimal structural shape of a menu item the adapter needs to push.
 *
 * Deliberately a narrow subset (not the full EditableMenuItem from the console
 * domain) so this module stays decoupled — any object carrying these fields can
 * be pushed, which keeps the integration layer testable in isolation.
 */
export interface MenuItemPushInput {
  id: string
  name: string
  /** Whole-rupee integer price (money is never a float in this app). */
  price: number
  /** Whether the item is currently orderable. */
  available: boolean
}

/**
 * Per-item availability flag used by stock sync.
 *
 * Mirrors the "item 86" / out-of-stock toggle every aggregator exposes:
 * we map a local sold-out/availability change to each platform's stock API.
 */
export interface ItemAvailability {
  itemId: string
  /** true = in stock / orderable, false = 86'd / hidden on the aggregator. */
  available: boolean
}

/** Result of a one-click menu publish. */
export interface PushMenuResult {
  ok: boolean
  /** Number of items accepted by (this simulation of) the aggregator. */
  count: number
}

/** Result of a stock/availability sync. */
export interface SyncStockResult {
  ok: boolean
}

/**
 * The adapter contract. One concrete implementation exists per aggregator.
 *
 * REAL-API SEAM: a production adapter would hold credentials (API key / OAuth
 * token, location/store id) and implement each method against the aggregator's
 * REST endpoints:
 *   - pushMenu      -> POST the catalogue (categories, items, modifiers, taxes)
 *   - ingestOrders  -> pull/receive new orders (poll endpoint or webhook queue)
 *   - syncStock     -> PATCH item availability ("86" toggles)
 * The mock implementation below honours the same shapes so swapping in a real
 * adapter is a drop-in replacement — no consumer code changes.
 */
export interface AggregatorAdapter {
  /** Stable platform identifier. */
  id: AggregatorId
  /** Human-readable label for UI (e.g. "Zomato"). */
  label: string
  /** Publish the current menu to the aggregator. */
  pushMenu(items: MenuItemPushInput[]): Promise<PushMenuResult>
  /** Pull new orders placed on the aggregator. Returns raw platform payloads. */
  ingestOrders(): Promise<unknown[]>
  /** Push per-item availability ("86" toggles) to the aggregator. */
  syncStock(itemAvailability: ItemAvailability[]): Promise<SyncStockResult>
}
