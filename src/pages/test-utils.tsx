import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Ctx, type AuthValue } from '../auth/context'
import type { Business, Membership } from '../api/types'

/** Ayudas de prueba para pantallas del panel: una sesión falsa de dueño o admin y el `<dialog>` que jsdom no implementa. */
export function polyfillDialog() {
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (!proto.showModal) {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}

export function fakeAuth(role: 'OWNER' | 'ADMIN' = 'OWNER'): AuthValue {
  const membership: Membership = { businessId: 'b1', businessName: 'Negocio', currency: 'NIO', memberId: role === 'OWNER' ? 'm-owner' : 'm-admin', role, timezone: 'America/Managua' }
  const business = { id: 'b1', name: 'Negocio', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00' } as Business
  return {
    status: 'ready',
    me: { id: 'u1', platformAdmin: false, businesses: [membership] },
    memberships: [membership],
    membership,
    business,
    canUsePanel: true,
    isOwner: role === 'OWNER',
    error: null,
    selectBusiness: () => undefined,
    reloadBusiness: async () => undefined,
    signInWithGoogle: async () => undefined,
    signInWithPlatform: async () => true,
    signInWithToken: async () => undefined,
    signOut: async () => undefined,
  }
}

export function renderAs(ui: ReactElement, role: 'OWNER' | 'ADMIN' = 'OWNER') {
  polyfillDialog()
  return render(<Ctx.Provider value={fakeAuth(role)}>{ui}</Ctx.Provider>)
}
