import type { ReactNode } from 'react'
import { Spinner } from '../components/ui'
import { usePlan } from './context'
import { GATEABLE, isSectionLocked } from './logic'
import { ProGate } from './ProGate'
import { SuspendedNotice } from './SuspendedNotice'

/**
 * Envuelve cada sección del menú. Tanto el clic en el menú como la dirección escrita a mano pasan por aquí:
 * negocio suspendido → aviso; sección fuera del plan → explicación; si el plan no se pudo cargar no se bloquea nada.
 */
export function SectionGuard({ navKey, children }: { navKey: string; children: ReactNode }) {
  const { plan, loading, suspended } = usePlan()
  if (suspended) return <SuspendedNotice />
  // Solo las secciones que el plan podría cerrar esperan a saber el plan; las demás abren de inmediato.
  if (loading && (GATEABLE as readonly string[]).includes(navKey)) return <Spinner />
  if (isSectionLocked(plan, navKey)) return <ProGate section={navKey} />
  return <>{children}</>
}
