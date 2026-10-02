import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantScope } from '../components/TenantScope'
import { useAsync } from '../hooks/useAsync'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './context'
import { clearSession, rememberUser, savedBusiness, saveBusiness, setToken } from './session'

/** ADR 0014: ni el navegador ni la memoria de las pantallas dejan datos de un negocio o de una cuenta a la vista de otra. */

function profile(id: string, businesses: { id: string; name: string }[]) {
  return { id, email: `${id}@test.com`, fullName: id, platformAdmin: false, locale: 'es', businesses: businesses.map((b) => ({ businessId: b.id, businessName: b.name, memberId: `m-${b.id}`, role: 'OWNER', currency: 'NIO', timezone: 'America/Managua' })) }
}

describe('sesión del navegador', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSession()
  })

  it('cerrar sesión olvida el negocio elegido y quién era el usuario', () => {
    setToken('t1')
    rememberUser('u1')
    saveBusiness('negocio-a')
    expect(savedBusiness()).toBe('negocio-a')
    clearSession()
    expect(savedBusiness()).toBeNull()
    expect(localStorage.getItem('cuadra.user')).toBeNull()
    expect(localStorage.getItem('cuadra.session')).toBeNull()
  })

  it('otra cuenta en el mismo navegador no hereda el negocio elegido de la anterior', () => {
    rememberUser('u1')
    saveBusiness('negocio-a')
    rememberUser('u1')
    expect(savedBusiness()).toBe('negocio-a')
    rememberUser('u2')
    expect(savedBusiness()).toBeNull()
  })
})

describe('memoria de las pantallas', () => {
  it('al cambiar de negocio las pantallas nacen vacías (no se queda la lista del anterior)', async () => {
    const loads: string[] = []
    function Sales({ business }: { business: string }) {
      const sales = useAsync(async () => {
        loads.push(business)
        return business === 'A' ? ['venta de A'] : []
      }, [business])
      const [draft] = useState(`borrador ${business}`)
      return <div data-testid="screen">{(sales.data ?? ['cargando']).join(',')}|{draft}</div>
    }
    const { rerender } = render(<TenantScope id="u1:A"><Sales business="A" /></TenantScope>)
    await waitFor(() => expect(screen.getByTestId('screen').textContent).toContain('venta de A'))
    // Sin el alcance, useAsync conservaría «venta de A» mientras carga el otro negocio. Con él, la pantalla es otra y empieza vacía.
    rerender(<TenantScope id="u1:B"><Sales business="B" /></TenantScope>)
    expect(screen.getByTestId('screen').textContent).not.toContain('venta de A')
    expect(screen.getByTestId('screen').textContent).toContain('borrador B')
    await waitFor(() => expect(loads).toEqual(['A', 'B']))
  })
})

describe('AuthProvider con dos cuentas', () => {
  const calls: string[] = []
  beforeEach(() => {
    localStorage.clear()
    clearSession()
    calls.length = 0
    vi.stubGlobal('fetch', vi.fn(async (input: Request) => {
      const url = new URL(input.url)
      const token = input.headers.get('Authorization')?.replace('Bearer ', '')
      calls.push(`${token} ${url.pathname}`)
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      if (url.pathname === '/api/me') return token === 'tok-1' ? json(profile('u1', [{ id: 'A', name: 'Quesería' }])) : json(profile('u2', [{ id: 'B', name: 'Pulpería' }]))
      const m = /\/api\/b\/([^/]+)$/.exec(url.pathname)
      if (m) {
        const allowed = (token === 'tok-1' && m[1] === 'A') || (token === 'tok-2' && m[1] === 'B')
        return allowed ? json({ id: m[1], name: m[1] === 'A' ? 'Quesería' : 'Pulpería', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00', defaultLocale: 'es', modules: {} }) : json({ code: 'BUSINESS_NOT_FOUND' }, 404)
      }
      return json({}, 404)
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  function Probe() {
    const { me, business, status } = useAuth()
    return <div data-testid="probe">{status}|{me?.id ?? '-'}|{business?.name ?? '-'}</div>
  }

  it('al entrar otra cuenta nunca se ve el perfil ni el negocio de la anterior, ni el negocio elegido pasa de una a otra', async () => {
    saveBusiness('A')
    rememberUser('u1')
    setToken('tok-1')
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('ready|u1|Quesería'))
    // Otra cuenta (el token cambia sin pasar por cerrar sesión, p. ej. "Ver como" o un token de desarrollo).
    const seen: string[] = []
    const watch = setInterval(() => seen.push(screen.getByTestId('probe').textContent ?? ''), 1)
    await act(async () => { setToken('tok-2') })
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('ready|u2|Pulpería'))
    clearInterval(watch)
    expect(seen.filter((s) => s.includes('u1') || s.includes('Quesería'))).toEqual([])
    // Nunca se pidió el negocio de una cuenta con el token de la otra.
    expect(calls.filter((c) => c.startsWith('tok-2') && c.endsWith('/b/A'))).toEqual([])
    expect(savedBusiness()).toBeNull()
  })
})
