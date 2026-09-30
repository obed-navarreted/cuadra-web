import type { ReactNode } from 'react'
import { usePlan } from './context'
import { SuspendedNotice } from './SuspendedNotice'

/** Envuelve cada sección del menú: con el negocio suspendido por la plataforma muestra el aviso. Ya no hay secciones cerradas por plan. */
export function SectionGuard({ children }: { navKey?: string; children: ReactNode }) {
  const { suspended } = usePlan()
  if (suspended) return <SuspendedNotice />
  return <>{children}</>
}
