import { Fragment, type ReactNode } from 'react'

/**
 * Todo lo que cuelga de aquí (listas cargadas, filtros, borradores) vive solo mientras `id` (persona + negocio) sea el mismo: al cambiar de negocio o de cuenta
 * se desmonta entero y las pantallas nacen vacías. Defensa en profundidad (ADR 0014): ningún dato de un negocio puede quedarse a la vista en el siguiente.
 */
export function TenantScope({ id, children }: { id: string; children: ReactNode }) {
  return <Fragment key={id}>{children}</Fragment>
}
