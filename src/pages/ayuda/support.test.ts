import { describe, expect, it } from 'vitest'
import { buildTicket, whatsappLink, validateTicket, type TicketDraft } from './support'

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

  it('el enlace de WhatsApp lleva solo dígitos y el mensaje escrito', () => {
    expect(whatsappLink('50582724138', 'Hola, quiero apoyar Cuentiva')).toBe('https://wa.me/50582724138?text=Hola%2C%20quiero%20apoyar%20Cuentiva')
    expect(whatsappLink('+505 8272-4138', 'x')).toBe('https://wa.me/50582724138?text=x')
    expect(whatsappLink('', 'x')).toBeNull()
    expect(whatsappLink(undefined, 'x')).toBeNull()
    expect(whatsappLink('abc', 'x')).toBeNull()
  })
})
