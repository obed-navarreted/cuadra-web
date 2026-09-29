import { describe, expect, it } from 'vitest'
import { activeRule, addDays, businessDate, isValidRange, presets } from './dates'

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

describe('regla de jornada vigente', () => {
  const fallback = { timezone: 'America/Costa_Rica', dayCutoff: '05:00:00' }
  const old = { from: '1970-01-01', timezone: 'America/Managua', dayCutoff: '02:00:00' }
  const next = { from: '2026-10-01', timezone: 'America/New_York', dayCutoff: '04:00:00' }

  it('sin reglas cae a la zona y el corte del negocio', () => {
    expect(activeRule([], new Date('2026-09-29T12:00:00Z'), fallback)).toEqual({ timezone: 'America/Costa_Rica', cutoff: '05:00' })
    expect(activeRule(undefined, new Date(), {})).toEqual({ timezone: 'UTC', cutoff: '02:00' })
  })

  it('una regla pendiente no rige todavía', () => {
    expect(activeRule([old, next], new Date('2026-09-29T12:00:00Z'), fallback)).toEqual({ timezone: 'America/Managua', cutoff: '02:00' })
  })

  it('la regla nueva rige cuando empieza su primera jornada (a su hora de corte)', () => {
    // 2026-10-01 07:59 UTC = 03:59 en Nueva York: todavía es la jornada del 30 (corte 04:00) -> aún la vieja.
    expect(activeRule([old, next], new Date('2026-10-01T07:59:00Z'), fallback).timezone).toBe('America/Managua')
    // 08:00 UTC = 04:00 en Nueva York: empieza el 1 de octubre.
    expect(activeRule([old, next], new Date('2026-10-01T08:00:00Z'), fallback)).toEqual({ timezone: 'America/New_York', cutoff: '04:00' })
    expect(activeRule([next, old], new Date('2026-12-01T12:00:00Z'), fallback).timezone).toBe('America/New_York')
  })
})
