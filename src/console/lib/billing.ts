// Billing catalog + pure helpers for the Subscription dashboard.
// Mirrors the commercial pricing model: a one-time build fee + an annual
// renewal, video baked in, 18% GST added on top. Demo-only — no real payment
// gateway is wired (Razorpay/Supabase land in a later phase).

import type { StatusStyle } from './statusColors'

export const GST_PCT = 18

export type PackageId = 'web-menu' | 'classic' | 'cinematic' | 'signature'

export interface BillingPackage {
  id: PackageId
  name: string
  oneTime: number // ex-GST one-time build fee
  renewalYr: number // ex-GST annual renewal
  video: string // short "what video / dashboard" line
  summary: string // target segment
}

export const PACKAGES: BillingPackage[] = [
  { id: 'web-menu', name: 'Web Menu', oneTime: 15000, renewalYr: 2999, video: 'No video · no dashboard', summary: 'Menu-only website, no backend' },
  { id: 'classic', name: 'Classic', oneTime: 24999, renewalYr: 2999, video: 'Images + staff console', summary: 'Café / QSR with dashboard' },
  { id: 'cinematic', name: 'Cinematic', oneTime: 54999, renewalYr: 4999, video: 'AI video across the menu', summary: 'Casual & premium dining' },
  { id: 'signature', name: 'Signature', oneTime: 89999, renewalYr: 4999, video: 'Full cinematic + white-label', summary: 'Fine-dining / flagship' },
]

export function packageById(id: PackageId): BillingPackage {
  return PACKAGES.find(p => p.id === id) ?? PACKAGES[1]
}

export type InvoiceStatus = 'paid' | 'due' | 'failed'

export interface Invoice {
  id: string // 'INV-0001'
  date: number // epoch ms
  description: string
  base: number // ex-GST
  gst: number // GST amount
  total: number // inc-GST
  status: InvoiceStatus
}

export interface Subscription {
  packageId: PackageId
  startedAt: number // epoch ms
  renewalAt: number // epoch ms (next renewal)
  autoRenew: boolean
  gstPct: number
}

export interface BillingState {
  subscription: Subscription
  invoices: Invoice[]
}

/** GST amount for an ex-GST value. */
export function gstOf(amount: number): number {
  return Math.round((amount * GST_PCT) / 100)
}

/** ex-GST → inc-GST total. */
export function withGst(amount: number): number {
  return amount + gstOf(amount)
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Whole days until a future epoch (negative if past). */
export function daysUntil(ts: number, now = Date.now()): number {
  return Math.ceil((ts - now) / 86_400_000)
}

/** Next sequential invoice id from the existing set. */
export function nextInvoiceId(invoices: Invoice[]): string {
  const max = invoices.reduce((m, i) => {
    const digits = i.id.replace(/\D/g, '')
    const n = digits.length > 0 ? Number(digits) : NaN
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `INV-${String(max + 1).padStart(4, '0')}`
}

/** Build a fully-computed invoice from an ex-GST base. */
export function makeInvoice(
  id: string,
  date: number,
  description: string,
  base: number,
  status: InvoiceStatus,
): Invoice {
  return { id, date, description, base, gst: gstOf(base), total: withGst(base), status }
}

export const INVOICE_STATUS: Record<InvoiceStatus, StatusStyle> = {
  paid: { label: 'Paid', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.4)' },
  due: { label: 'Due', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.5)' },
  failed: { label: 'Failed', fg: '#b3141b', tint: 'rgba(215,25,32,0.12)', ring: 'rgba(215,25,32,0.45)' },
}
