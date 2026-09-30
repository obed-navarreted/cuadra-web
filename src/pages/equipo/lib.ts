export const PIN_LENGTH = 5

/** Mismo criterio que el servidor (`INVALID_PIN`): exactamente 5 dígitos. */
export function isValidPin(pin: string): boolean {
  return /^\d{5}$/.test(pin)
}

/** Solo dígitos y como mucho 5: lo que se deja escribir en un campo de PIN. */
export function sanitizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

/** Un PIN al azar de 5 dígitos con el generador criptográfico del navegador (nunca `Math.random`). */
export function generatePin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000
  return String(n).padStart(PIN_LENGTH, '0')
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

/** El código del negocio son 5 dígitos sin separadores (así lo teclea la persona en su teléfono). */
export function normalizeAccessCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** Lo que se deja escribir al elegir un código propio: solo dígitos y como mucho 5. */
export function sanitizeAccessCode(raw: string): string {
  return normalizeAccessCode(raw).slice(0, 5)
}

/** Mismo criterio que el servidor (`INVALID_ACCESS_CODE`): 5 dígitos y el primero no es 0. */
export function isValidAccessCode(code: string): boolean {
  return /^[1-9]\d{4}$/.test(code)
}

/** El código con sus dígitos separados ("1 3 0 8 5"): para verlo grande y leerlo en voz alta o con lector de pantalla. */
export function formatAccessCode(raw: string | null | undefined): string {
  return normalizeAccessCode(raw).split('').join(' ')
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Mensaje listo para compartir el acceso al negocio (sin PIN: cada persona ya conoce el suyo). */
export function accessShareMessage(t: Translate, businessName: string, code: string): string {
  return t('accessCode.shareMessage', { business: businessName, code: normalizeAccessCode(code) })
}

/** Mensaje para una persona recién creada: negocio, código y PIN (su nombre, de referencia). */
export function credentialsMessage(t: Translate, businessName: string, code: string, name: string, pin: string): string {
  return t('created.message', { business: businessName, code: normalizeAccessCode(code), name, pin })
}

export type NewMemberIssue = 'name' | 'pin' | 'pinMismatch'

/** Qué falta para poder crear a la persona (null si todo está bien). El nombre no puede estar vacío. */
export function newMemberIssue(name: string, pin: string, pin2: string): NewMemberIssue | null {
  if (name.trim().length === 0) return 'name'
  if (!isValidPin(pin)) return 'pin'
  if (pin !== pin2) return 'pinMismatch'
  return null
}
