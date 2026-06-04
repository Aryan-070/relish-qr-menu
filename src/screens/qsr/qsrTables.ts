// Demo floor for the Waiter Copilot prototype. A real deployment reads these
// from the backend `RestaurantTable` model; here they are static so the pitch
// is fully clickable with no backend wiring.

export interface QsrTable {
  id: string
  label: string
  seats: number
  zone: string
}

export const QSR_TABLES: QsrTable[] = [
  { id: 'T01', label: 'T1', seats: 2, zone: 'Window' },
  { id: 'T02', label: 'T2', seats: 2, zone: 'Window' },
  { id: 'T03', label: 'T3', seats: 4, zone: 'Center' },
  { id: 'T04', label: 'T4', seats: 4, zone: 'Center' },
  { id: 'T05', label: 'T5', seats: 6, zone: 'Center' },
  { id: 'T06', label: 'T6', seats: 4, zone: 'Patio' },
  { id: 'T07', label: 'T7', seats: 8, zone: 'Patio' },
  { id: 'T08', label: 'T8', seats: 2, zone: 'Bar' },
]
