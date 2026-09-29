import { describe, expect, it } from 'vitest'
import { dstCutoffTip, observesDst, sinceForever, timezoneOptions } from './dayRule'

describe('regla de la jornada', () => {
  it('detecta las zonas que cambian de hora en verano (norte y sur) y las que no', () => {
    expect(observesDst('America/New_York', 2026)).toBe(true)
    expect(observesDst('Europe/Madrid', 2026)).toBe(true)
    expect(observesDst('America/Santiago', 2026)).toBe(true)
    expect(observesDst('America/Managua', 2026)).toBe(false)
    expect(observesDst('America/Costa_Rica', 2026)).toBe(false)
    expect(observesDst('UTC', 2026)).toBe(false)
  })

  it('una zona inválida no rompe: no avisa', () => {
    expect(observesDst('No/Existe')).toBe(false)
  })

  it('avisa solo con cambio de hora y corte antes de las 04:00', () => {
    expect(dstCutoffTip('America/New_York', '02:00', 2026)).toBe(true)
    expect(dstCutoffTip('America/New_York', '04:00', 2026)).toBe(false)
    expect(dstCutoffTip('America/New_York', '05:30', 2026)).toBe(false)
    expect(dstCutoffTip('America/Managua', '02:00', 2026)).toBe(false)
  })

  it('la lista de zonas siempre incluye la actual', () => {
    expect(timezoneOptions('America/Managua')).toContain('America/Managua')
    expect(timezoneOptions('Zona/Rara')[0]).toBe('Zona/Rara')
  })

  it('la primera regla vale desde siempre', () => {
    expect(sinceForever('0001-01-01')).toBe(true)
    expect(sinceForever(undefined)).toBe(true)
    expect(sinceForever('2026-09-30')).toBe(false)
  })
})
