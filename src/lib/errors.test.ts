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
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'DEVICES', limit: 2 }))).toBe('Tu plan Gratis permite hasta 2 teléfonos. Para conectar otro, pasa a Pro.')
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'EXPORT', limit: 0 }))).toContain('CSV')
  })
  it('PLAN_LIMIT con una función desconocida no muestra el error genérico', () => {
    expect(errorText(t, new ApiError(403, 'PLAN_LIMIT', 'x', { feature: 'NUEVA', limit: 1 }))).toContain('plan actual')
  })
  it('un negocio suspendido tiene su texto, y lo demás sigue por código', () => {
    expect(errorText(t, new ApiError(403, 'BUSINESS_SUSPENDED', 'x'))).toContain('suspendido')
    expect(errorText(t, new ApiError(0, 'OFFLINE', 'x'))).toBe('Sin conexión con el servidor.')
    expect(errorText(t, new Error('raro'))).toBe('Algo salió mal. Inténtalo de nuevo.')
  })
})
