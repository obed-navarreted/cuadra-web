import type { components } from '../api/schema'

/** Lógica pura de planes: sin React ni red, para probarla con casos conocidos. */
export type PlanView = components['schemas']['PlanView']
export type PlanLimits = components['schemas']['Limits']

/** Secciones del menú que el plan Gratis puede dejar fuera. Resumen, Ajustes, Ayuda y Plan nunca se bloquean. */
export const GATEABLE = ['ventas', 'fiados', 'gastos', 'inventario', 'cierres', 'reportes', 'equipo', 'avisos'] as const

/** Los topes de Pro son fijos y conocidos (el servidor manda los del plan actual; estos sirven para compararlos cuando el plan es Gratis). */
export const PRO_LIMITS = { members: 100, devices: 10, schedules: 50, reportHistoryDays: -1, export: true } as const
/** Lo que tendría el plan Gratis, para mostrarlo mientras el negocio está en Pro. */
export const FREE_LIMITS = { members: 3, devices: 2, schedules: 3, reportHistoryDays: 30, export: false, webSections: ['resumen', 'fiados', 'ajustes', 'ayuda'] } as const

export const FEATURES = ['MEMBERS', 'DEVICES', 'SCHEDULES', 'REPORT_HISTORY', 'EXPORT', 'BUSINESSES'] as const
export type Feature = (typeof FEATURES)[number]

/** ¿La sección queda cerrada por el plan? Sin plan conocido (aún cargando o falló la carga) nada se cierra: ante la duda, el negocio trabaja. */
export function isSectionLocked(plan: PlanView | undefined | null, key: string): boolean {
  if (!plan?.limits?.webSections) return false
  if (!(GATEABLE as readonly string[]).includes(key)) return false
  return !plan.limits.webSections.includes(key)
}

/** Exportar CSV: solo se marca como bloqueado cuando el servidor dice claramente que no. */
export function canExport(plan: PlanView | undefined | null): boolean {
  return plan?.limits ? plan.limits.export !== false : true
}

/** Porcentaje (0–100) de lo usado sobre el tope; un tope negativo o cero es "sin tope" y no llena la barra. */
export function usagePercent(used: number, limit: number): number {
  if (!(limit > 0)) return 0
  return Math.max(0, Math.min(100, Math.round((100 * used) / limit)))
}

export type UsageLevel = 'ok' | 'near' | 'full'
/** Lleno al llegar al tope, "cerca" desde el 80 %. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (!(limit > 0)) return 'ok'
  if (used >= limit) return 'full'
  return used / limit >= 0.8 ? 'near' : 'ok'
}

/** Clave de texto del aviso de `PLAN_LIMIT` según la función; una función desconocida cae en el mensaje general. */
export function planLimitKey(feature: string | undefined): string {
  return (FEATURES as readonly string[]).includes(feature ?? '') ? `limit.${feature}` : 'limit.generic'
}

export type PlanSituation = 'free' | 'trial' | 'pro' | 'pastDue' | 'canceled'

/** En qué situación está el negocio, en las palabras que la pantalla explica. */
export function situation(plan: PlanView): PlanSituation {
  if (plan.plan !== 'PRO') return 'free'
  if (plan.trialing) return 'trial'
  if (plan.status === 'PAST_DUE') return 'pastDue'
  if (plan.status === 'CANCELED') return 'canceled'
  return 'pro'
}
