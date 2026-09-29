import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Business } from '../../api/types'
import { Ctx, type AuthValue } from '../../auth/context'

/** Un negocio de prueba (Nicaragua: córdobas, hora de Managua) para pintar pantallas sin sesión real. */
export const testBusiness = { id: 'b1', name: 'Quesería', currency: 'NIO', country: 'NI', timezone: 'America/Managua', dayCutoff: '02:00' } as Business

export function renderWithBusiness(ui: ReactElement, route = '/') {
  const value: AuthValue = {
    status: 'ready',
    me: null,
    memberships: [],
    membership: { businessId: 'b1', role: 'OWNER' },
    business: testBusiness,
    canUsePanel: true,
    isOwner: true,
    error: null,
    selectBusiness: () => {},
    reloadBusiness: async () => {},
    signInWithGoogle: async () => {},
    signInWithPlatform: async () => true,
    signInWithToken: async () => {},
    signOut: async () => {},
  }
  return render(
    <Ctx.Provider value={value}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Ctx.Provider>,
  )
}
