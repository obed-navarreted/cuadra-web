import { describe, expect, it } from 'vitest'
import { assignableRoles, canManage, generatePin, isValidPin, normalizeCode } from './lib'

describe('equipo: reglas', () => {
  it('el PIN son de 4 a 6 dígitos', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('1234567')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('')).toBe(false)
  })

  it('el PIN generado siempre es válido y conserva los ceros a la izquierda', () => {
    for (let i = 0; i < 200; i++) expect(isValidPin(generatePin())).toBe(true)
  })

  it('un admin gestiona cajeros; solo el dueño gestiona admins; nadie toca al dueño', () => {
    expect(canManage(false, 'CASHIER')).toBe(true)
    expect(canManage(false, 'ADMIN')).toBe(false)
    expect(canManage(true, 'ADMIN')).toBe(true)
    expect(canManage(true, 'OWNER')).toBe(false)
    expect(canManage(false, undefined)).toBe(false)
  })

  it('solo el dueño puede asignar el rol de administrador', () => {
    expect(assignableRoles(true)).toEqual(['CASHIER', 'ADMIN'])
    expect(assignableRoles(false)).toEqual(['CASHIER'])
  })

  it('el código del teléfono se acepta con espacios, guiones y minúsculas', () => {
    expect(normalizeCode(' ab-12 cd ')).toBe('AB12CD')
  })
})
