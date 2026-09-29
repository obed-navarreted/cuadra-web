import { describe, expect, it } from 'vitest'
import { buildTicket, donationLink, validateTicket, type TicketDraft } from './support'

const ok: TicketDraft = { category: 'QUESTION', message: 'No me sincroniza el teléfono', email: '', phone: '' }

describe('ayuda y contacto', () => {
  it('pide un mensaje de verdad', () => {
    expect(validateTicket({ ...ok, message: 'hola' })).toBe('MESSAGE_SHORT')
    expect(validateTicket({ ...ok, message: 'x'.repeat(4001) })).toBe('MESSAGE_LONG')
    expect(validateTicket(ok)).toBeNull()
  })

  it('el correo y el teléfono son opcionales, pero si se dan deben parecer reales', () => {
    expect(validateTicket({ ...ok, email: 'dueño@negocio' })).toBe('EMAIL')
    expect(validateTicket({ ...ok, email: 'dueno@negocio.com' })).toBeNull()
    expect(validateTicket({ ...ok, phone: '12' })).toBe('PHONE')
    expect(validateTicket({ ...ok, phone: '+505 8812 4455' })).toBeNull()
  })

  it('arma la petición con el negocio, el idioma y datos técnicos sin nada personal', () => {
    const t = buildTicket({ ...ok, email: ' a@b.co ', message: ' Hola, necesito ayuda ' }, 'biz-1', 'en', 'Mozilla/5.0')
    expect(t).toMatchObject({ category: 'QUESTION', message: 'Hola, necesito ayuda', replyToEmail: 'a@b.co', replyToPhone: undefined, businessId: 'biz-1', locale: 'en' })
    expect(JSON.parse(t.diagnostics ?? '{}')).toEqual({ client: 'web', language: 'en', userAgent: 'Mozilla/5.0' })
  })

  it('el botón del café solo aparece con una dirección web válida', () => {
    expect(donationLink('https://buymeacoffee.com/x', 'external_link')).toBe('https://buymeacoffee.com/x')
    expect(donationLink('', 'external_link')).toBeNull()
    expect(donationLink(undefined, undefined)).toBeNull()
    expect(donationLink('javascript:alert(1)', 'external_link')).toBeNull()
    expect(donationLink('not a url', 'external_link')).toBeNull()
    expect(donationLink('https://buymeacoffee.com/x', 'off')).toBeNull()
  })
})
