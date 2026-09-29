import { describe, expect, it } from 'vitest'
import { canExport, isSectionLocked, planLimitKey, situation, usageLevel, usagePercent, type PlanView } from './logic'

const free: PlanView = {
  plan: 'FREE', status: 'MANUAL', trialing: false, trialDaysLeft: 0,
  limits: { members: 3, devices: 2, schedules: 3, reportHistoryDays: 30, export: false, multipleBusinesses: false, webSections: ['resumen', 'fiados', 'ajustes', 'ayuda'] },
  usage: { members: 1, devices: 2, schedules: 0 },
}
const pro: PlanView = { ...free, plan: 'PRO', status: 'TRIALING', trialing: true, trialDaysLeft: 12, limits: { ...free.limits!, members: 100, export: true, webSections: ['resumen', 'ventas', 'fiados', 'gastos', 'inventario', 'cierres', 'reportes', 'equipo', 'avisos', 'ajustes', 'ayuda'] } }

describe('uso frente al tope', () => {
  it('porcentaje entero, acotado a 0–100', () => {
    expect(usagePercent(2, 3)).toBe(67)
    expect(usagePercent(0, 3)).toBe(0)
    expect(usagePercent(5, 3)).toBe(100)
  })
  it('un tope de 0 o negativo (sin tope) no llena la barra', () => {
    expect(usagePercent(4, -1)).toBe(0)
    expect(usagePercent(4, 0)).toBe(0)
    expect(usageLevel(4, -1)).toBe('ok')
  })
  it('lleno al tope, cerca desde el 80 %', () => {
    expect(usageLevel(3, 3)).toBe('full')
    expect(usageLevel(4, 5)).toBe('near')
    expect(usageLevel(2, 3)).toBe('ok')
  })
})

describe('secciones bloqueadas por el plan', () => {
  it('Gratis deja fuera ventas y reportes, pero no fiados ni ajustes', () => {
    expect(isSectionLocked(free, 'ventas')).toBe(true)
    expect(isSectionLocked(free, 'reportes')).toBe(true)
    expect(isSectionLocked(free, 'fiados')).toBe(false)
    expect(isSectionLocked(free, 'ajustes')).toBe(false)
  })
  it('Resumen, Ajustes, Ayuda y Plan nunca se cierran, aunque el servidor no los listara', () => {
    const odd = { ...free, limits: { ...free.limits!, webSections: [] } }
    for (const k of ['resumen', 'ajustes', 'ayuda', 'plan', 'consola']) expect(isSectionLocked(odd, k)).toBe(false)
  })
  it('Pro no cierra nada', () => {
    for (const k of ['ventas', 'gastos', 'inventario', 'cierres', 'reportes', 'equipo', 'avisos']) expect(isSectionLocked(pro, k)).toBe(false)
  })
  it('ante un plan desconocido o incompleto no se bloquea nada (falla abierto)', () => {
    expect(isSectionLocked(undefined, 'ventas')).toBe(false)
    expect(isSectionLocked(null, 'ventas')).toBe(false)
    expect(isSectionLocked({ ...free, limits: undefined }, 'ventas')).toBe(false)
    expect(isSectionLocked({ ...free, limits: { ...free.limits!, webSections: null } }, 'ventas')).toBe(false)
  })
  it('exportar solo se marca bloqueado si el servidor lo dice', () => {
    expect(canExport(free)).toBe(false)
    expect(canExport(pro)).toBe(true)
    expect(canExport(undefined)).toBe(true)
  })
})

describe('mensajes y situación', () => {
  it('cada función tiene su texto y una desconocida cae en el general', () => {
    expect(planLimitKey('DEVICES')).toBe('limit.DEVICES')
    expect(planLimitKey('EXPORT')).toBe('limit.EXPORT')
    expect(planLimitKey('OTRA')).toBe('limit.generic')
    expect(planLimitKey(undefined)).toBe('limit.generic')
  })
  it('situación del negocio', () => {
    expect(situation(free)).toBe('free')
    expect(situation(pro)).toBe('trial')
    expect(situation({ ...pro, trialing: false, status: 'ACTIVE' })).toBe('pro')
    expect(situation({ ...pro, trialing: false, status: 'PAST_DUE' })).toBe('pastDue')
    expect(situation({ ...pro, trialing: false, status: 'CANCELED' })).toBe('canceled')
  })
})
