import type { components } from '../api/schema'

/** En esta versión todo es gratis y el único tope es de 10 personas por negocio; el resto del código de planes queda dormido en el servidor. */
export type PlanView = components['schemas']['PlanView']

export const FEATURES = ['MEMBERS', 'DEVICES', 'SCHEDULES', 'REPORT_HISTORY', 'EXPORT', 'BUSINESSES'] as const
export type Feature = (typeof FEATURES)[number]

/** Clave de texto del aviso de `PLAN_LIMIT` según la función; una función desconocida cae en el mensaje general. */
export function planLimitKey(feature: string | undefined): string {
  return (FEATURES as readonly string[]).includes(feature ?? '') ? `limit.${feature}` : 'limit.generic'
}
