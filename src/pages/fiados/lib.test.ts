import { describe, expect, it } from 'vitest'
import { ageInDays, daysBetween, whatsappUrl } from './lib'

describe('fiados: utilidades', () => {
  it('cuenta días entre fechas cruzando meses', () => {
    expect(daysBetween('2026-09-20', '2026-09-20')).toBe(0)
    expect(daysBetween('2026-08-31', '2026-09-02')).toBe(2)
  })

  it('la antigüedad se cuenta en jornadas del negocio, no en horas', () => {
    // 2026-09-21 04:30 UTC = 22:30 del 20 en Managua → jornada 20; hoy es la 21 → 1 día aunque pasaron pocas horas.
    expect(ageInDays('2026-09-21T04:30:00Z', '2026-09-21', 'America/Managua', '02:00')).toBe(1)
    expect(ageInDays('2026-09-21T15:00:00Z', '2026-09-21', 'America/Managua', '02:00')).toBe(0)
  })

  it('el enlace de WhatsApp lleva solo dígitos y nunca texto', () => {
    expect(whatsappUrl('50588123456')).toBe('https://wa.me/50588123456')
    expect(whatsappUrl('+505 8812-3456')).toBe('https://wa.me/50588123456')
    expect(whatsappUrl('123')).toBeNull()
    expect(whatsappUrl(undefined)).toBeNull()
  })
})
