import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { Business } from '../../api/types'
import { Ctx, type AuthValue } from '../../auth/context'

export const baseBusiness = {
  id: 'b1', name: 'Quesería', type: 'Lácteos', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00:00', defaultLocale: 'es', status: 'ACTIVE',
  modules: { credit: true, expenses: true, inventory: false, shifts: false, catalog: true, team: true }, posViews: ['TYPE'], creditRequiresCustomer: false, creditLimitEnforced: false,
  creditDefaultDueDays: 15, creditOverdueDays: 30, shiftRequired: false, shiftNoteThresholdMinor: 1000,
} as Business

/** El diálogo nativo no existe en jsdom: se imita lo mínimo (abrir y cerrar). */
export function polyfillDialog() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

export function renderPanel(ui: ReactElement, opts: { role?: 'OWNER' | 'ADMIN'; business?: Partial<Business>; reload?: () => Promise<void> } = {}) {
  const role = opts.role ?? 'OWNER'
  const value: AuthValue = {
    status: 'ready',
    me: null,
    memberships: [],
    membership: { businessId: 'b1', businessName: 'Quesería', role },
    business: { ...baseBusiness, ...opts.business } as Business,
    canUsePanel: true,
    isOwner: role === 'OWNER',
    error: null,
    selectBusiness: () => {},
    reloadBusiness: opts.reload ?? vi.fn(async () => {}),
    signInWithGoogle: async () => {},
    signInWithPlatform: async () => true,
    signInWithToken: async () => {},
    signOut: async () => {},
  }
  return render(
    <Ctx.Provider value={value}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Ctx.Provider>,
  )
}
