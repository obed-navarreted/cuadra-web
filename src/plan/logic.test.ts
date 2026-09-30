import { describe, expect, it } from 'vitest'
import { planLimitKey } from './logic'

describe('avisos de tope', () => {
  it('la clave depende de la función y una desconocida cae en el general', () => {
    expect(planLimitKey('MEMBERS')).toBe('limit.MEMBERS')
    expect(planLimitKey('DEVICES')).toBe('limit.DEVICES')
    expect(planLimitKey('OTRA')).toBe('limit.generic')
    expect(planLimitKey(undefined)).toBe('limit.generic')
  })
})
