// Generic client-side CSV download helper used by the Reports Center.
// Builds an RFC-4180-ish CSV string and triggers a real browser download
// via a Blob + a transient <a download> element.

/** Escape a single CSV cell: quote when it contains a comma, quote, or newline. */
function escapeCell(value: string | number): string {
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Build a CSV from a header row + data rows and download it as `filename`.
 * No-op outside the browser (defensive — this is a UI-only demo).
 */
export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number>>,
): void {
  const lines = [columns, ...rows].map(row => row.map(escapeCell).join(','))
  const csv = lines.join('\r\n')

  if (typeof document === 'undefined' || typeof URL === 'undefined') return

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
