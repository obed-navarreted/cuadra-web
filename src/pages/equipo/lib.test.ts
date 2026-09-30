import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { accessShareMessage, assignableRoles, canManage, credentialsMessage, formatAccessCode, generatePin, isValidPin, newMemberIssue, isValidAccessCode, normalizeAccessCode, sanitizeAccessCode, sanitizePin } from './lib'

describe('equipo: reglas', () => {
  it('el PIN son exactamente 5 dígitos', () => {
    expect(isValidPin('12345')).toBe(true)
    expect(isValidPin('00000')).toBe(true)
    expect(isValidPin('1234')).toBe(false)
    expect(isValidPin('123456')).toBe(false)
    expect(isValidPin('12a45')).toBe(false)
    expect(isValidPin('1234 ')).toBe(false)
    expect(isValidPin('')).toBe(false)
  })

  it('al escribir el PIN se quitan las letras y se corta en 5', () => {
    expect(sanitizePin('48a2')).toBe('482')
    expect(sanitizePin('1-2 3.4x5678')).toBe('12345')
  })

  it('el PIN generado siempre es válido y conserva los ceros a la izquierda', () => {
    for (let i = 0; i < 200; i++) expect(generatePin()).toMatch(/^\d{5}$/)
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
})

describe('equipo: código del negocio y alta de personas', () => {
  it('el código se normaliza y se separa dígito a dígito', () => {
    expect(normalizeAccessCode(' 130-85 ')).toBe('13085')
    expect(normalizeAccessCode(null)).toBe('')
    expect(formatAccessCode('13085')).toBe('1 3 0 8 5')
    expect(formatAccessCode(undefined)).toBe('')
  })

  it('un código propio: 5 dígitos y el primero no es 0', () => {
    expect(isValidAccessCode('13085')).toBe(true)
    expect(isValidAccessCode('99999')).toBe(true)
    expect(isValidAccessCode('03085')).toBe(false)
    expect(isValidAccessCode('1308')).toBe(false)
    expect(isValidAccessCode('130850')).toBe(false)
    expect(isValidAccessCode('1308a')).toBe(false)
    expect(sanitizeAccessCode('13a0-8 599')).toBe('13085')
  })

  it('los mensajes para compartir salen en cada idioma', () => {
    const es = i18n.getFixedT('es', 'equipo') as never
    const en = i18n.getFixedT('en', 'equipo') as never
    expect(accessShareMessage(es, 'Panadería', '13085')).toBe('Para entrar a Panadería en la app Cuentiva: código 13085, tu usuario y tu PIN.')
    expect(accessShareMessage(en, 'Bakery', '13085')).toBe('To join Bakery in the Cuentiva app: code 13085, your username and your PIN.')
    expect(credentialsMessage(es, 'Panadería', '13085', 'Rosa', '48213')).toBe('Para entrar a Panadería en la app Cuentiva: código 13085, usuario Rosa, PIN 48213.')
  })

  it('validación del alta: nombre, PIN de exactamente 5 dígitos y PIN repetido igual', () => {
    expect(newMemberIssue('  ', '12345', '12345')).toBe('name')
    expect(newMemberIssue('Rosa', '12', '12')).toBe('pin')
    expect(newMemberIssue('Rosa', '1234', '1234')).toBe('pin')
    expect(newMemberIssue('Rosa', '123456', '123456')).toBe('pin')
    expect(newMemberIssue('Rosa', '12345', '12346')).toBe('pinMismatch')
    expect(newMemberIssue('Rosa', '12345', '')).toBe('pinMismatch')
    expect(newMemberIssue('Rosa', '12345', '12345')).toBeNull()
  })

  it('NAME_TAKEN tiene texto en los dos idiomas', async () => {
    const { ApiError } = await import('../../api/http')
    const { errorText } = await import('../../lib/errors')
    const err = new ApiError(409, 'NAME_TAKEN', 'x')
    expect(errorText(i18n.getFixedT('es') as never, err)).toBe('Ya hay alguien con ese nombre en este negocio.')
    expect(errorText(i18n.getFixedT('en') as never, err)).toBe('There is already someone with that name in this business.')
  })
})
