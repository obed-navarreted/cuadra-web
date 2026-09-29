import { createContext, useContext } from 'react'
import type { PlanView } from './logic'

export type PlanValue = {
  /** El plan del negocio activo; `undefined` mientras carga o si no se pudo cargar (en ese caso nada se bloquea). */
  plan: PlanView | undefined
  loading: boolean
  failed: boolean
  /** El servidor dijo que el negocio está suspendido. */
  suspended: boolean
  reload: () => void
}

export const PlanCtx = createContext<PlanValue | null>(null)

/** Sin proveedor (por ejemplo en pruebas de una pantalla suelta) se comporta como "plan desconocido": nada se bloquea. */
const OPEN: PlanValue = { plan: undefined, loading: false, failed: false, suspended: false, reload: () => undefined }

export function usePlan(): PlanValue {
  return useContext(PlanCtx) ?? OPEN
}
