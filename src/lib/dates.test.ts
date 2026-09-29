import { describe, expect, it } from 'vitest'
import { addDays, businessDate, isValidRange, presets } from './dates'

describe('fechas del negocio', () => {
  it('una venta a la 1:30 a. m. pertenece a la jornada anterior (corte 02:00)', () => {
    // 2026-09-21 07:30 UTC = 01:30 en Managua (UTC−6).
    expect(businessDate(new Date('2026-09-21T07:30:00Z'), 'America/Managua', '02:00')).toBe('2026-09-20')
    // Y a las 02:30 ya es la nueva.
    expect(businessDate(new Date('2026-09-21T08:30:00Z'), 'America/Managua', '02:00')).toBe('2026-09-21')
  })

  it('usa la zona del negocio y no la del navegador', () => {
    // 2026-09-21 03:00 UTC: en Managua todavía es 20 de septiembre 21:00.
    expect(businessDate(new Date('2026-09-21T03:00:00Z'), 'America/Managua', '02:00')).toBe('2026-09-20')
    expect(businessDate(new Date('2026-09-21T03:00:00Z'), 'Europe/Madrid', '02:00')).toBe('2026-09-21')
  })

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('los atajos cubren hoy, ayer, 7 y 30 días y el mes actual y el pasado', () => {
    const p = presets('2026-09-29')
    expect(p.today).toEqual({ from: '2026-09-29', to: '2026-09-29' })
    expect(p.yesterday).toEqual({ from: '2026-09-28', to: '2026-09-28' })
    expect(p.last7).toEqual({ from: '2026-09-23', to: '2026-09-29' })
    expect(p.last30).toEqual({ from: '2026-08-31', to: '2026-09-29' })
    expect(p.thisMonth).toEqual({ from: '2026-09-01', to: '2026-09-29' })
    expect(p.lastMonth).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    expect(presets('2026-01-15').lastMonth).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('valida el rango', () => {
    expect(isValidRange({ from: '2026-09-20', to: '2026-09-21' })).toBe(true)
    expect(isValidRange({ from: '2026-09-21', to: '2026-09-20' })).toBe(false)
    expect(isValidRange({ from: '', to: '2026-09-20' })).toBe(false)
  })
})
