/** Mismo criterio que el servidor (`MemberService.validatePin`): de 4 a 6 dígitos. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

/** Un PIN al azar de 4 dígitos con el generador criptográfico del navegador (nunca `Math.random`). */
export function generatePin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10_000
  return String(n).padStart(4, '0')
}

export type ViewerRole = 'OWNER' | 'ADMIN' | 'CASHIER'

export type Permissions = { edit: boolean; disable: boolean; resetPin: boolean; changeRole: boolean }

const NONE: Permissions = { edit: false, disable: false, resetPin: false, changeRole: false }

/**
 * Qué puede hacer quien mira sobre una persona del equipo. El dueño gestiona a todos; el administrador a todos menos al dueño (cajeros y otros
 * administradores); el cajero solo a sí mismo. Nadie se da de baja ni se cambia el rol a sí mismo (sí su nombre, color y PIN). Nadie modifica al
 * dueño salvo él mismo (nombre, color, PIN). El servidor lo exige igual (`MemberService`): esto solo evita mostrar botones que darían error.
 */
export function canManage(viewerRole: string | null | undefined, viewerIsSelf: boolean, targetRole: string | null | undefined): Permissions {
  if (viewerRole !== 'OWNER' && viewerRole !== 'ADMIN' && viewerRole !== 'CASHIER') return NONE
  if (viewerIsSelf) return { edit: true, resetPin: true, disable: false, changeRole: false }
  if (viewerRole === 'CASHIER' || targetRole === 'OWNER') return NONE
  return { edit: true, disable: true, resetPin: true, changeRole: true }
}

/** Roles que puede asignar quien mira al crear o invitar: el dueño y el administrador ofrecen cajero y administrador. */
export function assignableRoles(viewerRole: string | null | undefined): ('ADMIN' | 'CASHIER')[] {
  return viewerRole === 'OWNER' || viewerRole === 'ADMIN' ? ['CASHIER', 'ADMIN'] : []
}

export const COLORS = ['#1f7a55', '#c9793a', '#2f6db5', '#8a4fb0', '#b5443a', '#3c8f9a', '#8c7a2b', '#5e594f'] as const

/** Un código de teléfono: se acepta con espacios o guiones y en minúsculas. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
