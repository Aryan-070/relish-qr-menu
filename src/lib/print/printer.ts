/**
 * printer.ts — the *only* non-pure file in the print module.
 *
 * The ticket/receipt **text** is built by the pure {@link module:print/escpos}
 * builder. This file is the thin browser-side bridge that takes that text and
 * hands it to the operating system's print dialog by opening a tiny popup window
 * containing the text in a monospace `<pre>` and calling `window.print()`.
 *
 * It is deliberately guarded for SSR / non-browser environments: every entry
 * point checks for `window`/`document` first and degrades to a no-op result
 * instead of throwing, so the module is safe to import anywhere (the demo runs
 * keyless and backend-optional).
 */

/** Options for the browser print window. */
export interface PrintViaBrowserOptions {
  /** Document title for the print window (shown in some print dialogs). */
  title?: string
  /** Font size in points for the monospace body. Defaults to `12`. */
  fontSizePt?: number
  /**
   * Auto-close the popup after printing. Defaults to `true`. Set `false` when
   * debugging so the window stays open for inspection.
   */
  autoClose?: boolean
}

/** Result of a {@link printViaBrowser} attempt. */
export interface PrintResult {
  /** `true` when a print window was opened; `false` when guarded/blocked. */
  ok: boolean
  /** A short, user-facing reason when `ok` is `false`. */
  reason?: string
}

/** True only in a real browser with the DOM and `window.open` available. */
function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof window.open === 'function'
  )
}

/**
 * Escape a string for safe interpolation into HTML text content, preventing the
 * ticket text (which may contain `<`, `>`, `&`) from breaking the markup or
 * injecting nodes. The text is rendered inside a `<pre>` so whitespace and
 * newlines are preserved verbatim.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Open a browser print window containing `text` rendered as monospace and
 * trigger the OS print dialog. **Browser-only**: in SSR or any environment
 * without `window`/`document` this is a guarded no-op returning
 * `{ ok: false, reason }` rather than throwing.
 *
 * The window writes a minimal self-contained HTML document (no external assets)
 * with the text in a `<pre>`, calls `print()` once the document is ready, and —
 * unless `autoClose` is `false` — closes itself afterward. If the popup is
 * blocked, returns `{ ok: false, reason: 'Popup blocked' }`.
 *
 * @param text The ticket/receipt text from the pure builder.
 * @param opts Title, font size and auto-close options.
 * @returns    A {@link PrintResult} describing the outcome.
 *
 * @example
 *   const ticket = buildKot(order, { station: 'hot' })
 *   printViaBrowser(ticket, { title: 'KOT — Hot Kitchen' })
 */
export function printViaBrowser(
  text: string,
  opts: PrintViaBrowserOptions = {},
): PrintResult {
  if (!isBrowser()) {
    return { ok: false, reason: 'Printing is only available in the browser' }
  }

  const win = window.open('', '_blank', 'width=420,height=640')
  if (!win) {
    return { ok: false, reason: 'Popup blocked — allow pop-ups to print' }
  }

  const title = opts.title ?? 'Print'
  const fontSizePt = Number.isFinite(opts.fontSizePt)
    ? Math.min(24, Math.max(8, opts.fontSizePt as number))
    : 12
  const autoClose = opts.autoClose ?? true

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 6mm; }
  html, body { margin: 0; padding: 0; }
  pre {
    font-family: "Menlo", "Consolas", "Courier New", monospace;
    font-size: ${fontSizePt}pt;
    line-height: 1.25;
    white-space: pre;
    margin: 0;
    padding: 8px;
  }
</style>
</head>
<body><pre>${escapeHtml(text)}</pre></body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()

  // Print once the document has settled. `onload` is the most reliable hook for
  // a freshly-written document; fall back to a microtask if it never fires.
  const doPrint = (): void => {
    try {
      win.focus()
      win.print()
    } finally {
      if (autoClose) {
        win.close()
      }
    }
  }

  if (win.document.readyState === 'complete') {
    doPrint()
  } else {
    win.onload = doPrint
  }

  return { ok: true }
}
