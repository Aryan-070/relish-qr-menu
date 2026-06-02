// Keyless demo notify provider — never touches the network.
//
// Resolves `ok: true` for every message so the sales demo can show a realistic
// "sent" flow without credentials, rate limits, or external dependencies.

import type { NotifyMessage, NotifyProvider, NotifyResult } from './types'

export const demoProvider: NotifyProvider = {
  async send(msg: NotifyMessage): Promise<NotifyResult> {
    return { ok: true, channel: msg.channel }
  },
}
