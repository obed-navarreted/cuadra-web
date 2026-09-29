import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, endViewAs, getToken, getViewAs, setToken, startViewAs, subscribe } from './session'
import { formatCountdown, secondsLeft } from './viewAs'

const INFO = { businessId: 'b1', businessName: 'Quesería', expiresAt: '2026-09-29T12:30:00Z' }

describe('temporizador de "Ver como"', () => {
  it('segundos que faltan, sin bajar de cero', () => {
    const now = Date.parse('2026-09-29T12:00:00Z')
    expect(secondsLeft('2026-09-29T12:30:00Z', now)).toBe(1800)
    expect(secondsLeft('2026-09-29T12:00:00.400Z', now)).toBe(1)
    expect(secondsLeft('2026-09-29T11:00:00Z', now)).toBe(0)
    expect(secondsLeft('no es fecha', now)).toBe(0)
  })
  it('mm:ss', () => {
    expect(formatCountdown(1800)).toBe('30:00')
    expect(formatCountdown(65)).toBe('01:05')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-3)).toBe('00:00')
  })
})

describe('cambio de sesión "Ver como"', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSession()
  })

  it('aparta la sesión del admin, usa la de solo lectura y la restaura al salir', () => {
    setToken('admin-token')
    expect(getViewAs()).toBeNull()
    startViewAs('view-token', INFO)
    expect(getToken()).toBe('view-token')
    expect(getViewAs()).toEqual(INFO)
    expect(endViewAs()).toBe(true)
    expect(getToken()).toBe('admin-token')
    expect(getViewAs()).toBeNull()
  })

  it('mirar otro negocio sin salir no pierde la sesión del admin', () => {
    setToken('admin-token')
    startViewAs('view-1', INFO)
    startViewAs('view-2', { ...INFO, businessId: 'b2' })
    endViewAs()
    expect(getToken()).toBe('admin-token')
  })

  it('salir sin estar en "Ver como" no cambia nada', () => {
    setToken('admin-token')
    expect(endViewAs()).toBe(false)
    expect(getToken()).toBe('admin-token')
  })

  it('cerrar sesión borra también lo apartado', () => {
    setToken('admin-token')
    startViewAs('view-token', INFO)
    clearSession()
    expect(getToken()).toBeNull()
    expect(getViewAs()).toBeNull()
    expect(localStorage.getItem('cuadra.session.admin')).toBeNull()
  })

  it('avisa a los suscriptores y devuelve el mismo objeto mientras no cambie', () => {
    setToken('admin-token')
    const listener = vi.fn()
    const off = subscribe(listener)
    startViewAs('view-token', INFO)
    expect(getViewAs()).toBe(getViewAs())
    endViewAs()
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2)
    off()
  })
})
