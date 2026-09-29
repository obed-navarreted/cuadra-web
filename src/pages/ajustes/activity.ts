/** Lógica pura del registro de actividad. */

/** Las acciones que hace la plataforma llevan el prefijo `platform.`: se destacan y se le explican al dueño. */
export function isPlatformAction(action: string | null | undefined): boolean {
  return !!action && action.startsWith('platform.')
}

/** Clave de traducción de una acción conocida, o `null` para mostrar la acción tal cual llegó. */
const KNOWN = ['platform.view_as', 'platform.plan_changed', 'platform.trial_extended', 'platform.suspended', 'platform.unsuspended', 'platform.flag', 'platform.deletion_marked']
export function actionKey(action: string | null | undefined): string | null {
  return action && KNOWN.includes(action) ? `activity.actions.${action.replace('.', '_')}` : null
}

/** El servidor guarda el motivo dentro del detalle ("… — motivo: texto"): se separa para mostrarlo aparte. */
export function splitReason(detail: string | null | undefined): { note: string | null; reason: string | null } {
  if (!detail) return { note: null, reason: null }
  const m = /^(?:(.*?)\s+—\s+)?motivo:\s*(.*)$/s.exec(detail)
  if (!m) return { note: detail, reason: null }
  return { note: m[1] || null, reason: m[2].trim() || null }
}
