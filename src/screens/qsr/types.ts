import type { useOrder } from '../../hooks/useOrder'

/** The shared cart API, owned by QsrApp and passed to both views. */
export type OrderApi = ReturnType<typeof useOrder>
