// Notification primitives — channel-agnostic contracts for outreach.
//
// DEMO-FIRST: the only provider wired today is the keyless demo provider
// (see demoProvider.ts). Real WhatsApp/SMS/Email adapters can implement the
// same `NotifyProvider` interface later without touching call sites.

export type NotifyChannel = 'whatsapp' | 'sms' | 'email'

export interface NotifyMessage {
  channel: NotifyChannel
  to: string
  body: string
  subject?: string
}

export interface NotifyResult {
  ok: boolean
  channel: NotifyChannel
  error?: string
}

export interface NotifyProvider {
  send(msg: NotifyMessage): Promise<NotifyResult>
}
