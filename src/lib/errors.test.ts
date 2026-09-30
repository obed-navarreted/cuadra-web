import i18n from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '../api/http'
import '../i18n'
import { setLocale } from '../i18n'
import { errorText } from './errors'

beforeAll(async () => {
  await setLocale('es')
})

describe('errorText', () => {
  const t = i18n.t.bind(i18n)
  it('PLAN_LIMIT usa la función y el tope', () => {
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'DEVICES', limit: 2 }))).toBe('Máximo 2 teléfonos por negocio.')
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'MEMBERS', limit: 10 }))).toBe('Máximo 10 personas por negocio.')
  })
  it('PLAN_LIMIT con una función desconocida no muestra el error genérico', () => {
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'NUEVA', limit: 1 }))).toContain('límite')
  })
  it('un negocio suspendido tiene su texto, y lo demás sigue por código', () => {
    expect(errorText(t, new ApiError(403, 'BUSINESS_SUSPENDED', 'x'))).toContain('suspendido')
    expect(errorText(t, new ApiError(0, 'OFFLINE', 'x'))).toBe('Sin conexión con el servidor.')
    expect(errorText(t, new Error('raro'))).toBe('Algo salió mal. Inténtalo de nuevo.')
  })
})
