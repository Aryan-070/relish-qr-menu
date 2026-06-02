// Public entry point for the aggregator integration layer.
//
// Re-exports the contract types and exposes the demo-ready adapter registry.
// A future console view ("Channels" / "Aggregators") consumes AGGREGATORS to
// render one card per platform with one-click menu push + stock sync.

import { makeMockAdapter } from './mockAdapter'
import type { AggregatorAdapter } from './types'

export type {
  AggregatorAdapter,
  AggregatorId,
  ItemAvailability,
  MenuItemPushInput,
  PushMenuResult,
  SyncStockResult,
} from './types'
export { makeMockAdapter } from './mockAdapter'

/**
 * All four aggregator adapters, keyless and demo-ready.
 *
 * REAL-API SEAM: in production this array is built from configured connections
 * (per outlet) — each entry would be a credentialed adapter instead of a mock.
 * Consumers iterate this list and never construct adapters directly.
 */
export const AGGREGATORS: AggregatorAdapter[] = [
  makeMockAdapter('zomato', 'Zomato'),
  makeMockAdapter('swiggy', 'Swiggy'),
  makeMockAdapter('ubereats', 'Uber Eats'),
  makeMockAdapter('doordash', 'DoorDash'),
]
