import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { QrCode as QrCodeIcon, Printer, Copy, Check } from 'lucide-react'
import { useTheme } from '../../theme/ThemeContext'
import { useOpsStore } from '../store/useOpsStore'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { isHard } from '../lib/skin'
import { fadeUp, stagger } from '../../animations/variants'
import { tableQrUrl } from '../../lib/tableSession'
import type { Table } from '../lib/types'

/** Origin used to build every QR URL — guarded for SSR/no-window contexts. */
function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}

type QrState =
  | { status: 'loading' }
  | { status: 'ready'; dataUrl: string }
  | { status: 'error' }

interface TableQrProps {
  tableId: string
  url: string
}

/** Renders a single table's QR code, generated asynchronously from `url`. */
function TableQr({ tableId, url }: TableQrProps) {
  const { tokens: t } = useTheme()
  const [qr, setQr] = useState<QrState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setQr({ status: 'loading' })
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then(dataUrl => {
        if (!cancelled) setQr({ status: 'ready', dataUrl })
      })
      .catch(() => {
        if (!cancelled) setQr({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const radius = isHard(t) ? 0 : 12
  const box = 200

  if (qr.status === 'ready') {
    return (
      <img
        src={qr.dataUrl}
        alt={`QR code linking to the menu for ${tableId}`}
        width={box}
        height={box}
        className="block"
        style={{ width: box, height: box, borderRadius: radius, background: '#fff' }}
      />
    )
  }

  return (
    <div
      className="grid place-items-center"
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: 'rgba(42,30,30,0.04)',
        border: `1px dashed ${t.ruleColor}`,
      }}
      role="status"
      aria-live="polite"
    >
      <span className="text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
        {qr.status === 'error' ? 'Could not render' : 'Generating…'}
      </span>
    </div>
  )
}

interface QrCardProps {
  table: Table
  url: string
}

function QrCard({ table, url }: QrCardProps) {
  const { tokens: t } = useTheme()
  const { push } = useToast()
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      push(`Copied link · ${table.label}`, 'success')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      push('Could not copy link', 'warn')
    }
  }

  const radius = isHard(t) ? 0 : t.cardRadius

  return (
    <motion.div variants={fadeUp}>
      <div
        className="flex flex-col items-center gap-3 p-4 h-full"
        style={{
          background: t.bg === '#F4F4F0' ? '#FFFFFF' : '#FFFCF6',
          border: t.cardBorder !== 'none' ? t.cardBorder : `1px solid ${t.ruleColor}`,
          borderRadius: radius,
        }}
      >
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span
            className="text-[15px] leading-tight"
            style={{ fontFamily: t.titleFont, color: t.ink, fontWeight: t.titleWeight }}
          >
            {table.label}
          </span>
          <span className="text-[12px]" style={{ color: t.descColor, fontFamily: t.descFont }}>
            {table.zone}
          </span>
        </div>

        <TableQr tableId={table.id} url={url} />

        <code
          className="text-[10px] leading-snug break-all text-center px-1"
          style={{ color: t.inkSoft, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {url}
        </code>

        <div className="no-print mt-auto pt-1 w-full">
          <Button variant="subtle" size="sm" fullWidth onClick={copyLink} aria-label={`Copy link for ${table.label}`}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export function QrCodes() {
  const { tokens: t } = useTheme()
  const ops = useOpsStore()

  const origin = currentOrigin()

  const tables = useMemo(
    () => [...ops.state.tables].sort((a, b) => a.id.localeCompare(b.id)),
    [ops.state.tables],
  )

  const cards = useMemo(
    () => tables.map(table => ({ table, url: tableQrUrl(origin, table.id) })),
    [tables, origin],
  )

  const print = () => {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h1 className="text-[24px] leading-none" style={{ fontFamily: t.headerFont, color: t.ink }}>
            Table QR Codes
          </h1>
          <p className="text-[13px] mt-1" style={{ color: t.descColor, fontFamily: t.descFont }}>
            Print a scan-to-order code for each table.
          </p>
        </div>
        {cards.length > 0 && (
          <Button variant="primary" size="md" onClick={print}>
            <Printer size={16} />
            Print all
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <Panel padded={false}>
          <EmptyState
            icon={<QrCodeIcon size={30} />}
            title="No tables yet"
            description="Add tables to the floor to generate scan-to-order QR codes."
          />
        </Panel>
      ) : (
        <div className="print-area">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {cards.map(({ table, url }) => (
              <QrCard key={table.id} table={table} url={url} />
            ))}
          </motion.div>
        </div>
      )}
    </div>
  )
}
