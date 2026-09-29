/** Mismo criterio que el servidor (`MemberService.validatePin`): de 4 a 6 dígitos. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

/** Un PIN al azar de 4 dígitos con el generador criptográfico del navegador (nunca `Math.random`). */
export function generatePin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10_000
  return String(n).padStart(4, '0')
}

/**
 * A quién puede gestionar quien mira: un administrador gestiona cajeros; solo el dueño gestiona administradores; nadie modifica al dueño.
 * (El servidor lo exige igual: esto solo evita mostrar botones que darían error.)
 */
export function canManage(isOwner: boolean, targetRole: string | null | undefined): boolean {
  if (targetRole === 'CASHIER') return true
  return targetRole === 'ADMIN' && isOwner
}

/** Roles que puede asignar quien mira. */
export function assignableRoles(isOwner: boolean): ('ADMIN' | 'CASHIER')[] {
  return isOwner ? ['CASHIER', 'ADMIN'] : ['CASHIER']
}

export const COLORS = ['#1f7a55', '#c9793a', '#2f6db5', '#8a4fb0', '#b5443a', '#3c8f9a', '#8c7a2b', '#5e594f'] as const

/** Un código de teléfono: se acepta con espacios o guiones y en minúsculas. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
