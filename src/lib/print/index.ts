/**
 * print/ — KOT (kitchen order ticket) and customer-receipt printing.
 *
 * Split into a pure text builder ({@link module:print/escpos}) and a single
 * browser-only bridge ({@link module:print/printer}). Import builders anywhere
 * (server or client); call {@link printViaBrowser} only in the browser.
 */
export {
  DEFAULT_WIDTH,
  NARROW_WIDTH,
  DEFAULT_STATION_MAP,
  buildKot,
  buildKotsByStation,
  buildReceiptText,
  consolidateForReceipt,
} from './escpos'
export type {
  Station,
  StationMap,
  KotOptions,
  ReceiptOptions,
  ReceiptLine,
} from './escpos'
export { printViaBrowser } from './printer'
export type { PrintViaBrowserOptions, PrintResult } from './printer'
