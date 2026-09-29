import { describe, expect, it } from 'vitest'
import {
  EMPTY_ANNOUNCEMENT,
  buildAnnouncementInput,
  buildSegment,
  bannerIsLive,
  cohortRow,
  fillDays,
  isValidConfigValue,
  planKeyLabel,
  retentionPct,
  splitList,
  splitPlanKey,
  validateAnnouncement,
  type AnnouncementForm,
} from './lib'

const NOW = Date.parse('2026-09-29T12:00:00Z')
const form = (over: Partial<AnnouncementForm> = {}): AnnouncementForm => ({ ...EMPTY_ANNOUNCEMENT, title: 'Novedad', body: 'Hay cambios', ...over })

describe('retención', () => {
  it('porcentaje de la cohorte, redondeado y sin pasar de 100', () => {
    expect(retentionPct(1, 3)).toBe(33)
    expect(retentionPct(2, 3)).toBe(67)
    expect(retentionPct(5, 5)).toBe(100)
    expect(retentionPct(9, 5)).toBe(100)
  })
  it('una cohorte vacía o sin actividad es 0 %', () => {
    expect(retentionPct(3, 0)).toBe(0)
    expect(retentionPct(0, 4)).toBe(0)
  })
  it('la fila llega hasta la semana actual y rellena con 0 % las semanas sin actividad', () => {
    // cohorte del 2026-09-07; hoy es 2026-09-29 → semanas 0..3
    const row = cohortRow({ week: '2026-09-07', size: 4, active: [4, 2] }, NOW)
    expect(row.cells).toEqual([100, 50, 0, 0])
  })
  it('la cohorte de esta semana solo tiene la semana 0', () => {
    expect(cohortRow({ week: '2026-09-28', size: 2, active: [1] }, NOW).cells).toEqual([50])
    expect(cohortRow({ week: '2026-09-28', size: 2, active: [] }, NOW).cells).toEqual([0])
  })
})

describe('claves de plan', () => {
  const t = (key: string, o?: { defaultValue?: string }) => ({ 'plan.PRO': 'Pro', 'plan.FREE': 'Gratis', 'planStatus.TRIALING': 'En prueba' })[key] ?? o?.defaultValue ?? key
  it('separa plan y estado', () => {
    expect(splitPlanKey('PRO:TRIALING')).toEqual({ plan: 'PRO', status: 'TRIALING' })
    expect(splitPlanKey('FREE')).toEqual({ plan: 'FREE', status: null })
  })
  it('se muestran con nombre legible y lo desconocido tal cual', () => {
    expect(planKeyLabel('PRO:TRIALING', t)).toBe('Pro · En prueba')
    expect(planKeyLabel('FREE', t)).toBe('Gratis')
    expect(planKeyLabel('TEAM:WEIRD', t)).toBe('TEAM · WEIRD')
  })
})

describe('segmento', () => {
  it('separa por comas, espacios o líneas, sin repetidos ni vacíos', () => {
    expect(splitList('ni, cr;\n ni  ,, pa')).toEqual(['ni', 'cr', 'pa'])
  })
  it('países y planes en mayúsculas, solo las listas con algo', () => {
    expect(buildSegment({ countries: 'ni, cr', plans: 'pro', appVersions: '', businessIds: '' })).toEqual({ countries: ['NI', 'CR'], plans: ['PRO'] })
    expect(buildSegment({ countries: '', plans: '', appVersions: ' ', businessIds: '' })).toEqual({})
  })
  it('las versiones se dejan como se escriben', () => {
    expect(buildSegment({ countries: '', plans: '', appVersions: '1.4.0 1.4.1', businessIds: '' })).toEqual({ appVersions: ['1.4.0', '1.4.1'] })
  })
})

describe('anuncio', () => {
  it('un anuncio completo es válido y arma el cuerpo', () => {
    expect(validateAnnouncement(form(), NOW)).toEqual([])
    expect(buildAnnouncementInput(form({ title: ' Hola ', deepLink: ' ' }))).toEqual({ title: 'Hola', body: 'Hay cambios', deepLink: undefined, audience: 'OWNERS', segment: {}, banner: false, bannerUntil: undefined, scheduledAt: undefined })
  })
  it('título y mensaje obligatorios y con tope', () => {
    expect(validateAnnouncement(form({ title: ' ', body: '' }), NOW)).toEqual(['titleRequired', 'bodyRequired'])
    expect(validateAnnouncement(form({ title: 'x'.repeat(81), body: 'y'.repeat(501) }), NOW)).toEqual(['titleTooLong', 'bodyTooLong'])
    expect(validateAnnouncement(form({ title: 'x'.repeat(80) }), NOW)).toEqual([])
  })
  it('la franja no va con segmento', () => {
    expect(validateAnnouncement(form({ banner: true, countries: 'NI' }), NOW)).toContain('bannerSegment')
    expect(validateAnnouncement(form({ banner: true }), NOW)).toEqual([])
  })
  it('ids de negocio mal escritos, franja en el pasado y horas de envío', () => {
    expect(validateAnnouncement(form({ businessIds: 'no-es-uuid' }), NOW)).toContain('businessIds')
    expect(validateAnnouncement(form({ businessIds: '3f2b8c1e-1111-4222-8333-444455556666' }), NOW)).toEqual([])
    expect(validateAnnouncement(form({ banner: true, bannerUntil: '2020-01-01T10:00' }), NOW)).toContain('bannerUntilPast')
    expect(validateAnnouncement(form({ mode: 'schedule' }), NOW)).toContain('scheduleRequired')
    expect(validateAnnouncement(form({ mode: 'schedule', scheduledAt: '2020-01-01T10:00' }), NOW)).toContain('schedulePast')
    expect(validateAnnouncement(form({ mode: 'schedule', scheduledAt: '2999-01-01T10:00' }), NOW)).toEqual([])
  })
  it('programado lleva la hora en ISO; la franja solo si está activa', () => {
    const input = buildAnnouncementInput(form({ mode: 'schedule', scheduledAt: '2999-01-01T10:00', banner: true, bannerUntil: '2999-02-01T10:00' }))
    expect(input.scheduledAt).toMatch(/^2999-01-01T\d\d:\d\d:00\.000Z$/)
    expect(input.bannerUntil).toMatch(/^2999-02-01T/)
    expect(buildAnnouncementInput(form({ banner: false, bannerUntil: '2999-02-01T10:00' })).bannerUntil).toBeUndefined()
  })
  it('una franja se puede terminar mientras esté vigente', () => {
    expect(bannerIsLive({ banner: true, state: 'SENT', bannerUntil: null }, NOW)).toBe(true)
    expect(bannerIsLive({ banner: true, state: 'SENT', bannerUntil: '2026-09-29T11:00:00Z' }, NOW)).toBe(false)
    expect(bannerIsLive({ banner: true, state: 'CANCELLED', bannerUntil: null }, NOW)).toBe(false)
    expect(bannerIsLive({ banner: false, state: 'SENT' }, NOW)).toBe(false)
  })
})

describe('configuración remota', () => {
  it('valida como el servidor y vacío borra', () => {
    expect(isValidConfigValue('donation_url', 'https://ko-fi.com/x')).toBe(true)
    expect(isValidConfigValue('donation_url', 'http://ko-fi.com/x')).toBe(false)
    expect(isValidConfigValue('donation_mode', 'ko_fi')).toBe(true)
    expect(isValidConfigValue('donation_mode', 'ko fi')).toBe(false)
    expect(isValidConfigValue('min_app_version', '1.4.0')).toBe(true)
    expect(isValidConfigValue('min_app_version', '1.4.0.1.2')).toBe(false)
    expect(isValidConfigValue('recommended_app_version', '  ')).toBe(true)
  })
})

describe('ventas por día', () => {
  it('rellena con ceros hasta completar los días', () => {
    const days = fillDays([{ day: '2026-09-28', sales: 5, businesses: 2 }], '2026-09-29', 3)
    expect(days).toEqual([
      { day: '2026-09-27', sales: 0, businesses: 0 },
      { day: '2026-09-28', sales: 5, businesses: 2 },
      { day: '2026-09-29', sales: 0, businesses: 0 },
    ])
  })
})
