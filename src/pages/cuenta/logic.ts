import type { components } from '../../api/schema'

type Membership = components['schemas']['Membership']

/** Negocios activos de los que la persona es dueña: mientras tenga alguno, no puede eliminar su cuenta (el servidor responde OWNS_BUSINESSES). */
export function ownedBusinesses(memberships: Membership[]): Membership[] {
  return memberships.filter((m) => m.role === 'OWNER')
}

/** La palabra que hay que escribir para confirmar. */
export function deleteWord(language: string): string {
  return language.startsWith('en') ? 'DELETE' : 'ELIMINAR'
}
