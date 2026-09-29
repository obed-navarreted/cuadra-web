import type { TFunction } from 'i18next'
import { ApiError } from '../api/http'
import { planLimitKey } from '../plan/logic'

/** El texto de un error de la API: por su `code` estable (`errors.<CODE>`), o el genérico. Nunca el texto que manda el servidor. */
export function errorText(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'generic'
  // Tope del plan: el texto depende de qué se quiso hacer (`feature`) e incluye el tope (`limit`).
  if (error instanceof ApiError && code === 'PLAN_LIMIT') return t(`plan:${planLimitKey(error.feature)}`, { limit: error.limit ?? 0 })
  // Los códigos de la consola de plataforma (y VIEW_AS_READ_ONLY) viven en el área `consola`.
  return t(`errors.${code}`, { defaultValue: t(`consola:errors.${code}`, { defaultValue: t('errors.generic') }) })
}
