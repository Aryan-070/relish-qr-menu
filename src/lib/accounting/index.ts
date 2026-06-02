/**
 * accounting/ — pure exporters from billed orders to back-office formats.
 *
 * {@link toTallyCsv} emits a Tally voucher register CSV; {@link toQuickBooksJson}
 * emits a QuickBooks-style sales-receipt JSON array. Both reuse the shared
 * {@link module:tax} engine so the books reconcile with the on-screen bill.
 */
export { toTallyCsv, toQuickBooksJson } from './export'
export type {
  ExportOptions,
  QuickBooksLine,
  QuickBooksReceipt,
} from './export'
