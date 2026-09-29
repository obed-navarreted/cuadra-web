import { createContext, useContext } from 'react'
import type { Business, Me, Membership } from '../api/types'

export type Status = 'loading' | 'signedOut' | 'ready'

export type AuthValue = {
  status: Status
  me: Me | null
  memberships: Membership[]
  membership: Membership | null
  business: Business | null
  /** Solo dueño y admins usan el panel web (los cajeros trabajan en la app del teléfono). */
  canUsePanel: boolean
  isOwner: boolean
  error: string | null
  selectBusiness: (id: string) => void
  reloadBusiness: () => Promise<void>
  signInWithGoogle: (idToken: string) => Promise<void>
  /** Acceso de plataforma (usuario y contraseña). `true` si entró; si no, `error` trae el código. */
  signInWithPlatform: (username: string, password: string) => Promise<boolean>
  signInWithToken: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

export const Ctx = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}

/** El negocio elegido, siempre presente dentro del panel (el shell no monta las pantallas sin él). */
export function useBusiness(): { membership: Membership; business: Business } {
  const { membership, business } = useAuth()
  if (!membership || !business) throw new Error('useBusiness sin negocio')
  return { membership, business }
}
