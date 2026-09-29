import { useMemo, type ReactNode } from 'react'
import { ApiError, call, client } from '../api/http'
import { useAuth } from '../auth/context'
import { useAsync } from '../hooks/useAsync'
import { PlanCtx, type PlanValue } from './context'
import type { PlanView } from './logic'

type Loaded = { id: string; plan?: PlanView; error?: unknown }

/** Carga el plan una vez por negocio y lo vuelve a cargar al cambiar de negocio. Si la carga falla no bloquea nada. */
export function PlanProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth()
  const id = business?.id
  const state = useAsync<Loaded | undefined>(async () => {
    if (!id) return undefined
    try {
      return { id, plan: await call(client.GET('/api/b/{businessId}/plan', { params: { path: { businessId: id } } })) }
    } catch (error) {
      return { id, error }
    }
  }, [id])

  const value = useMemo<PlanValue>(() => {
    // `useAsync` conserva el dato viejo mientras recarga: lo de OTRO negocio no se usa.
    const mine = state.data && state.data.id === id ? state.data : undefined
    return {
      plan: mine?.plan,
      loading: !!id && !mine,
      failed: !!mine?.error,
      suspended: mine?.error instanceof ApiError && mine.error.code === 'BUSINESS_SUSPENDED',
      reload: state.reload,
    }
  }, [state.data, state.reload, id])

  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>
}
