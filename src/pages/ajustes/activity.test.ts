import { describe, expect, it } from 'vitest'
import { actionKey, isPlatformAction, splitReason } from './activity'

describe('registro de actividad', () => {
  it('reconoce las acciones de la plataforma', () => {
    expect(isPlatformAction('platform.view_as')).toBe(true)
    expect(isPlatformAction('sale.cancel')).toBe(false)
    expect(isPlatformAction(null)).toBe(false)
  })
  it('traduce las conocidas y deja pasar las demás', () => {
    expect(actionKey('platform.suspended')).toBe('activity.actions.platform_suspended')
    expect(actionKey('sale.cancel')).toBeNull()
  })
  it('separa el motivo del detalle', () => {
    expect(splitReason('motivo: cliente pidió ayuda')).toEqual({ note: null, reason: 'cliente pidió ayuda' })
    expect(splitReason('PRO/MANUAL — motivo: acuerdo')).toEqual({ note: 'PRO/MANUAL', reason: 'acuerdo' })
    expect(splitReason('sin motivo aquí')).toEqual({ note: 'sin motivo aquí', reason: null })
    expect(splitReason(null)).toEqual({ note: null, reason: null })
  })
})
