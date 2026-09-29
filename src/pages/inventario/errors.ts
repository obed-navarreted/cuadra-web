import type { TFunction } from 'i18next'
import { ApiError } from '../../api/http'
import { errorText } from '../../lib/errors'

/**
 * El texto de un error de la API en esta área: primero `errors.<CODE>` de inventario, luego el de `common` y al final el genérico. Nunca el texto del servidor.
 * (`t` debe ser el de `useTranslation('inventario')`: `fallbackNS` da acceso a los errores comunes.)
 */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'generic'
  // Los topes del plan y la suspensión se explican igual en todo el panel.
  if (code === 'PLAN_LIMIT' || code === 'BUSINESS_SUSPENDED') return errorText(t, error)
  return t(`errors.${code}`, { defaultValue: t('errors.generic') })
}

export const newId = () => crypto.randomUUID()
