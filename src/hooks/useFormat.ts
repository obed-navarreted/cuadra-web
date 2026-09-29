import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../auth/context'
import { formatMoney, formatQuantity } from '../lib/money'
import { businessDate, formatDateTime, formatDay, presets } from '../lib/dates'

/** Formateadores del negocio actual: dinero con su moneda y país, fechas en su zona horaria. */
export function useFormat() {
  const { business } = useBusiness()
  const { i18n } = useTranslation()
  const money = useCallback((minor: number) => formatMoney(minor, business.currency ?? 'USD', business.country ?? undefined, i18n.language), [business.currency, business.country, i18n.language])
  const quantity = useCallback((milli: number) => formatQuantity(milli, i18n.language), [i18n.language])
  const day = useCallback((iso: string) => formatDay(iso, i18n.language), [i18n.language])
  const dateTime = useCallback((instant: string) => formatDateTime(instant, business.timezone ?? 'UTC', i18n.language), [business.timezone, i18n.language])
  const today = useCallback(() => businessDate(new Date(), business.timezone ?? 'UTC', business.dayCutoff?.slice(0, 5) ?? '02:00'), [business.timezone, business.dayCutoff])
  return { money, quantity, day, dateTime, today, presets: (now?: string) => presets(now ?? today()), currency: business.currency ?? 'USD', timezone: business.timezone ?? 'UTC' }
}
