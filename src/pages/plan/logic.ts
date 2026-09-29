import { FREE_LIMITS, PRO_LIMITS, type PlanView } from '../../plan/logic'

/** Lógica pura de la pantalla de plan. */

export type Usage = { key: 'members' | 'devices' | 'schedules'; used: number; limit: number }

/** Lo usado frente al tope del plan de hoy, en el orden en que se muestra. Sin datos de uso o de límites no hay nada que mostrar. */
export function usageRows(plan: PlanView): Usage[] {
  if (!plan.usage || !plan.limits) return []
  return (['members', 'devices', 'schedules'] as const).map((key) => ({ key, used: plan.usage?.[key] ?? 0, limit: plan.limits?.[key] ?? 0 }))
}

export type CompareRow = { key: 'members' | 'devices' | 'schedules' | 'history' | 'export' | 'sections' | 'businesses'; free: string | number | boolean; pro: string | number | boolean }

/**
 * Gratis contra Pro. Con plan Gratis, lo de Gratis sale del servidor; con Pro, lo de Gratis es lo conocido (lo que tendría) y lo de Pro son los topes fijos.
 * Los valores especiales (`'history30'`, `'all'`, `'one'`…) los traduce la pantalla.
 */
export function compareRows(plan: PlanView): CompareRow[] {
  const free = plan.plan === 'FREE' && plan.limits ? plan.limits : FREE_LIMITS
  return [
    { key: 'members', free: free.members, pro: PRO_LIMITS.members },
    { key: 'devices', free: free.devices, pro: PRO_LIMITS.devices },
    { key: 'schedules', free: free.schedules, pro: PRO_LIMITS.schedules },
    { key: 'history', free: free.reportHistoryDays < 0 ? 'unlimited' : 'history30', pro: 'unlimited' },
    { key: 'export', free: free.export, pro: PRO_LIMITS.export },
    { key: 'sections', free: 'sections', pro: 'all' },
    { key: 'businesses', free: 'one', pro: 'several' },
  ]
}

/** Las secciones que incluye Gratis, en su orden. */
export function freeSections(plan: PlanView): string[] {
  const sections = plan.plan === 'FREE' && plan.limits?.webSections ? plan.limits.webSections : [...FREE_LIMITS.webSections]
  return sections
}
