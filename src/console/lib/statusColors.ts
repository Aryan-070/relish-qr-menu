// Status → semantic colour, derived from the existing brand tokens.
// available=olive, seated=ink-soft, ordering=gold, bill-requested=maroon,
// needs-attention=red. Used by Badge, floor grids, and table cards.

import type { RequestStatus, RequestType, TableStatus } from './types'

export interface StatusStyle {
  label: string
  fg: string // text/icon colour (≥4.5:1 on its tint)
  tint: string // soft background fill
  ring: string // border colour
}

export const TABLE_STATUS: Record<TableStatus, StatusStyle> = {
  available: { label: 'Available', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.40)' },
  seated: { label: 'Seated', fg: '#4a3f3a', tint: 'rgba(74,63,58,0.10)', ring: 'rgba(74,63,58,0.32)' },
  ordering: { label: 'Ordering', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.55)' },
  'bill-requested': { label: 'Bill requested', fg: '#8B1024', tint: 'rgba(139,16,36,0.10)', ring: 'rgba(139,16,36,0.40)' },
  'needs-attention': { label: 'Needs attention', fg: '#b3141b', tint: 'rgba(215,25,32,0.12)', ring: 'rgba(215,25,32,0.50)' },
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  waiter: 'Call waiter',
  water: 'Water',
  bill: 'Bill',
  assistance: 'Assistance',
  cleanup: 'Cleanup',
}

export const REQUEST_STATUS: Record<RequestStatus, StatusStyle> = {
  pending: { label: 'Pending', fg: '#b3141b', tint: 'rgba(215,25,32,0.12)', ring: 'rgba(215,25,32,0.45)' },
  claimed: { label: 'Claimed', fg: '#8a6212', tint: 'rgba(217,160,58,0.16)', ring: 'rgba(217,160,58,0.5)' },
  resolved: { label: 'Resolved', fg: '#3d6130', tint: 'rgba(79,122,60,0.12)', ring: 'rgba(79,122,60,0.4)' },
}
