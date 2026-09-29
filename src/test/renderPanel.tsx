import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Business, Membership } from '../api/types'
import { Ctx, type AuthValue } from '../auth/context'
import '../i18n'

// jsdom todavía no trae el elemento <dialog> completo: se simula lo mínimo (abrir y cerrar) para probar los diálogos.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

export const testBusiness: Business = { id: 'b1', name: 'Quesería', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00', defaultLocale: 'es', modules: {} } as Business
const membership: Membership = { businessId: 'b1', businessName: 'Quesería', currency: 'NIO', memberId: 'm1', role: 'OWNER', timezone: 'America/Managua' }

export function authValue(over: Partial<AuthValue> = {}): AuthValue {
  return {
    status: 'ready',
    me: null,
    memberships: [membership],
    membership,
    business: testBusiness,
    canUsePanel: true,
    isOwner: true,
    error: null,
    selectBusiness: () => undefined,
    reloadBusiness: async () => undefined,
    signInWithGoogle: async () => undefined,
    signInWithPlatform: async () => true,
    signInWithToken: async () => undefined,
    signOut: async () => undefined,
    ...over,
  }
}

/** Renderiza una pantalla del panel como si hubiera un dueño con un negocio en córdobas (zona de Managua). */
export function renderPanel(ui: ReactElement, { path = '/', auth }: { path?: string; auth?: Partial<AuthValue> } = {}) {
  return render(
    <Ctx.Provider value={authValue(auth)}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </Ctx.Provider>,
  )
}

/** Respuesta de la API simulada: `openapi-fetch` devuelve `{ data, response }`. */
export function ok<T>(data: T) {
  return Promise.resolve({ data, response: new Response(null, { status: 200 }) })
}

export function fail(status: number, code: string) {
  return Promise.resolve({ error: { code }, response: new Response(null, { status }) })
}
