// Table-QR binding for the guest app.
//
// Each physical table gets a QR code encoding the menu URL with a `?t=<tableId>`
// (and optional `?seats=<n>`) parameter. When a guest scans it, the app reads
// the table from the URL and attaches it to their order so it lands on the right
// ticket. With no parameter (e.g. opening the demo directly) we fall back to a
// fixed demo table so the flow still works.

const DEMO_TABLE_ID = 'T07'

/** Read the bound table id from the current URL's `?t=` param, if present. */
export function getTableIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = new URLSearchParams(window.location.search).get('t')
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

/** The table this guest session is bound to — scanned QR param, else the demo table. */
export function resolveGuestTableId(): string {
  return getTableIdFromUrl() ?? DEMO_TABLE_ID
}

/** Build the scan URL a table's QR code should encode (used by the console QR view). */
export function tableQrUrl(origin: string, tableId: string): string {
  return `${origin}/?t=${encodeURIComponent(tableId)}`
}
