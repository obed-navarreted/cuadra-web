import type { components } from '../../api/schema'

export type TicketRequest = components['schemas']['TicketRequest']
export const CATEGORIES = ['QUESTION', 'PROBLEM', 'SUGGESTION', 'BILLING'] as const
export type Category = (typeof CATEGORIES)[number]

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 4000

export type TicketError = 'MESSAGE_SHORT' | 'MESSAGE_LONG' | 'EMAIL' | 'PHONE'

export type TicketDraft = { category: Category; message: string; email: string; phone: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Lo mínimo para que soporte pueda contestar: un mensaje de verdad y, si se da, un correo o teléfono que tengan forma de tal. */
export function validateTicket(d: TicketDraft): TicketError | null {
  const m = d.message.trim()
  if (m.length < MESSAGE_MIN) return 'MESSAGE_SHORT'
  if (m.length > MESSAGE_MAX) return 'MESSAGE_LONG'
  if (d.email.trim() && (d.email.trim().length > 200 || !EMAIL.test(d.email.trim()))) return 'EMAIL'
  if (d.phone.trim() && (d.phone.trim().length > 40 || d.phone.replace(/\D/g, '').length < 6)) return 'PHONE'
  return null
}

/** Datos técnicos que ayudan a resolver el problema. Nada personal: solo el cliente y el navegador. */
export function diagnostics(userAgent: string, language: string): string {
  return JSON.stringify({ client: 'web', language, userAgent: userAgent.slice(0, 300) })
}

export function buildTicket(d: TicketDraft, businessId: string | null | undefined, locale: string, userAgent: string): TicketRequest {
  return {
    category: d.category,
    message: d.message.trim(),
    replyToEmail: d.email.trim() || undefined,
    replyToPhone: d.phone.trim() || undefined,
    businessId,
    locale: locale === 'en' ? 'en' : 'es',
    diagnostics: diagnostics(userAgent, locale),
  }
}

/** Enlace de Buy Me a Coffee solo si es una dirección web segura y el modo no lo apaga. */
export function donationLink(url: string | null | undefined, mode: string | null | undefined): string | null {
  if (!url || /^(off|none|disabled|hidden)$/i.test(mode ?? '')) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}
