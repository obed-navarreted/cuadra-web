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

  const all = { edit: true, disable: true, resetPin: true, changeRole: true }
  const selfOnly = { edit: true, disable: false, resetPin: true, changeRole: false }
  const none = { edit: false, disable: false, resetPin: false, changeRole: false }

  it('el dueño gestiona a todos; sobre sí mismo solo nombre y PIN', () => {
    expect(canManage('OWNER', false, 'ADMIN')).toEqual(all)
    expect(canManage('OWNER', false, 'CASHIER')).toEqual(all)
    expect(canManage('OWNER', true, 'OWNER')).toEqual(selfOnly)
  })

  it('el administrador gestiona cajeros y otros administradores, no al dueño', () => {
    expect(canManage('ADMIN', false, 'CASHIER')).toEqual(all)
    expect(canManage('ADMIN', false, 'ADMIN')).toEqual(all)
    expect(canManage('ADMIN', false, 'OWNER')).toEqual(none)
    expect(canManage('ADMIN', true, 'ADMIN')).toEqual(selfOnly)
  })

  it('el cajero solo se gestiona a sí mismo', () => {
    expect(canManage('CASHIER', true, 'CASHIER')).toEqual(selfOnly)
    expect(canManage('CASHIER', false, 'CASHIER')).toEqual(none)
    expect(canManage('CASHIER', false, 'ADMIN')).toEqual(none)
    expect(canManage('CASHIER', false, 'OWNER')).toEqual(none)
  })

  it('las 3x3 combinaciones (quien mira x a quién) sobre otra persona', () => {
    const expected: Record<string, Record<string, boolean>> = {
      OWNER: { OWNER: false, ADMIN: true, CASHIER: true },
      ADMIN: { OWNER: false, ADMIN: true, CASHIER: true },
      CASHIER: { OWNER: false, ADMIN: false, CASHIER: false },
    }
    for (const viewer of ['OWNER', 'ADMIN', 'CASHIER']) {
      for (const target of ['OWNER', 'ADMIN', 'CASHIER']) {
        expect(canManage(viewer, false, target), `${viewer} -> ${target}`).toEqual(expected[viewer][target] ? all : none)
      }
    }
  })

  it('un rol desconocido o ausente no puede nada', () => {
    expect(canManage(undefined, false, 'CASHIER')).toEqual(none)
    expect(canManage('X', true, 'CASHIER')).toEqual(none)
  })

  it('el dueño y el administrador asignan cajero y administrador; el cajero nada', () => {
    expect(assignableRoles('OWNER')).toEqual(['CASHIER', 'ADMIN'])
    expect(assignableRoles('ADMIN')).toEqual(['CASHIER', 'ADMIN'])
    expect(assignableRoles('CASHIER')).toEqual([])
  })

  it('el código del teléfono se acepta con espacios, guiones y minúsculas', () => {
    expect(normalizeCode(' ab-12 cd ')).toBe('AB12CD')
  })
})
