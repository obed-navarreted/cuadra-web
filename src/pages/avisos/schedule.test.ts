import { describe, expect, it } from 'vitest'
import { buildInput, buildRule, draftOf, emptyDraft, summarize, validateDraft, validDate, validTime, type ScheduleView } from './schedule'
import { panelRoute } from './notificationText'

const ok = { ...emptyDraft(), title: 'Hola', body: 'Cuenta el fondo', all: true }

describe('borrador de programación', () => {
  it('valida hora y fecha reales', () => {
    expect(validTime('09:00')).toBe(true)
    expect(validTime('24:00')).toBe(false)
    expect(validTime('9:00')).toBe(false)
    expect(validDate('2026-02-29')).toBe(false)
    expect(validDate('2028-02-29')).toBe(true)
  })

  it('pide título, mensaje y audiencia, en ese orden', () => {
    expect(validateDraft({ ...ok, title: '' })).toBe('TITLE')
    expect(validateDraft({ ...ok, body: ' ' })).toBe('BODY')
    expect(validateDraft({ ...ok, all: false })).toBe('AUDIENCE')
    expect(validateDraft({ ...ok, title: 'x'.repeat(101) })).toBe('TITLE')
    expect(validateDraft(ok)).toBeNull()
  })

  it('revisa cada modo de repetición', () => {
    expect(validateDraft({ ...ok, repeat: 'WEEKLY', days: [] })).toBe('DAYS')
    expect(validateDraft({ ...ok, repeat: 'WEEKLY', days: [1] })).toBeNull()
    expect(validateDraft({ ...ok, repeat: 'MONTHLY', dayOfMonth: '32' })).toBe('DAY_OF_MONTH')
    expect(validateDraft({ ...ok, repeat: 'MONTHLY', dayOfMonth: '31' })).toBeNull()
    expect(validateDraft({ ...ok, repeat: 'EVERY_N_DAYS', everyDays: '0' })).toBe('EVERY_DAYS')
    expect(validateDraft({ ...ok, time: '99:00' })).toBe('TIME')
    expect(validateDraft({ ...ok, endDate: '2026-13-01' })).toBe('END_DATE')
    expect(validateDraft({ ...ok, when: 'once', date: '', time: '09:00' })).toBe('DATE')
    expect(validateDraft({ ...ok, when: 'now', title: 'a', body: 'b' })).toBeNull()
  })

  it('arma la regla que espera el servidor', () => {
    expect(buildRule({ ...ok, repeat: 'WEEKLY', days: [5, 1], time: '21:30' })).toEqual({ type: 'WEEKLY', time: '21:30', days: [1, 5] })
    expect(buildRule({ ...ok, repeat: 'MONTHLY', dayOfMonth: '15', endDate: '2027-01-01' })).toEqual({ type: 'MONTHLY', time: '09:00', dayOfMonth: 15, endDate: '2027-01-01' })
    expect(buildRule({ ...ok, repeat: 'EVERY_N_DAYS', everyDays: '3' })).toEqual({ type: 'EVERY_N_DAYS', time: '09:00', everyDays: 3 })
    expect(buildRule({ ...ok, when: 'once', date: '2026-10-05', time: '08:00' })).toEqual({ type: 'ONCE', at: '2026-10-05T08:00' })
  })

  it('la audiencia "todo el equipo" no manda roles ni personas', () => {
    expect(buildInput({ ...ok, all: true, roles: ['ADMIN'], memberIds: ['x'] }).audience).toEqual({ all: true, roles: [], memberIds: [], deviceIds: [] })
    expect(buildInput({ ...ok, all: false, roles: ['CASHIER'] }).audience).toEqual({ all: false, roles: ['CASHIER'], memberIds: [], deviceIds: [] })
  })

  it('una programación existente vuelve al editor tal cual', () => {
    const s: ScheduleView = { id: 'a', active: true, sent: 0, read: 0, title: 'T', body: 'B', deepLink: 'cuadra://caja', audience: { all: false, roles: ['ADMIN'], memberIds: [] }, rule: { type: 'WEEKLY', time: '09:00:00', days: [1, 3] } }
    const d = draftOf(s)
    expect(d).toMatchObject({ id: 'a', when: 'repeat', repeat: 'WEEKLY', time: '09:00', days: [1, 3], roles: ['ADMIN'], link: 'cuadra://caja' })
    expect(draftOf({ ...s, rule: { type: 'ONCE', at: '2026-10-05T08:30' } })).toMatchObject({ when: 'once', date: '2026-10-05', time: '08:30' })
  })

  it('resume las reglas como datos', () => {
    expect(summarize({ type: 'DAILY', time: '21:00' })).toEqual({ kind: 'daily', time: '21:00' })
    expect(summarize({ type: 'WEEKLY', time: '09:00', days: [3, 1] })).toEqual({ kind: 'weekly', days: [1, 3], time: '09:00' })
    expect(summarize({ type: 'ONCE', at: '2026-10-05T09:00' })).toEqual({ kind: 'once', date: '2026-10-05', time: '09:00' })
  })
})

describe('enlaces de las notificaciones', () => {
  it('se traducen a rutas del panel; lo que es solo del teléfono no tiene ruta', () => {
    expect(panelRoute('cuadra://inventario?filtro=bajo')).toBe('/inventario')
    expect(panelRoute('cuadra://cierre/abc')).toBe('/cierres')
    expect(panelRoute('cuadra://fiados')).toBe('/fiados')
    expect(panelRoute('cuadra://notificaciones')).toBe('/avisos')
    expect(panelRoute('cuadra://caja')).toBeNull()
    expect(panelRoute(undefined)).toBeNull()
  })
})
