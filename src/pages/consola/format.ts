import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../lib/dates'

/** Formatos de la consola: fechas en la zona horaria de quien mira (no hay un negocio) y nombres de país e idioma. Los números son conteos. */
export function useConsoleFormat() {
  const { i18n, t } = useTranslation('consola')
  const lang = i18n.language
  const dateTime = useCallback((iso?: string | null) => (iso ? formatDateTime(iso, undefined, lang) : '—'), [lang])
  const date = useCallback((iso?: string | null) => (iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso)) : '—'), [lang])
  const number = useCallback((n: number) => new Intl.NumberFormat(lang).format(n), [lang])
  const country = useCallback(
    (code?: string | null) => {
      if (!code) return '—'
      try {
        return `${new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase()) ?? code} (${code})`
      } catch {
        return code
      }
    },
    [lang],
  )
  const language = useCallback(
    (code?: string | null) => {
      if (!code) return '—'
      try {
        return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code
      } catch {
        return code
      }
    },
    [lang],
  )
  /** `-` es "sin dato" para el servidor. */
  const orNone = useCallback((v?: string | null) => (!v || v === '-' ? t('none') : v), [t])
  return { dateTime, date, number, country, language, orNone }
}
