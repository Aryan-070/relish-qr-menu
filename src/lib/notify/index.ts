// Notify provider selection.
//
// For now everything resolves to the keyless demo provider. When real adapters
// land, switch here based on env/config — call sites stay unchanged.

import { demoProvider } from './demoProvider'
import type { NotifyProvider } from './types'

export type { NotifyChannel, NotifyMessage, NotifyResult, NotifyProvider } from './types'
export { demoProvider } from './demoProvider'

export function getNotifyProvider(): NotifyProvider {
  return demoProvider
}
