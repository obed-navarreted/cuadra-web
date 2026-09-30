import type { components } from '../../api/schema'

export type TicketRequest = components['schemas']['TicketRequest']
/** «Cobros y planes» ya no se ofrece (no hay planes); el servidor aún lo acepta. */
export const CATEGORIES = ['QUESTION', 'PROBLEM', 'SUGGESTION'] as const
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

/** Datos de contacto y apoyo si el servidor aún no los manda (se pueden cambiar sin lanzar versión desde `/api/config`). */
export const DEFAULT_SUPPORT_WHATSAPP = '50582724138'
export const DEFAULT_SUPPORT_EMAIL = 'ndiazobed@gmail.com'

/** Enlace de WhatsApp con el mensaje escrito; solo dígitos en el número (se quita «+», espacios y guiones). Sin número válido, `null`. */
export function whatsappLink(number: string | null | undefined, message: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
