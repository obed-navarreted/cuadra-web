import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../auth/context'
import { formatMoney, formatQuantity } from '../lib/money'
import { activeRule, businessDate, formatDateTime, formatDay, presets } from '../lib/dates'

/** Formateadores del negocio actual: dinero con su moneda y país, fechas en su zona horaria. */
export function useFormat() {
  const { business } = useBusiness()
  const { i18n } = useTranslation()
  const money = useCallback((minor: number) => formatMoney(minor, business.currency ?? 'USD', business.country ?? undefined, i18n.language), [business.currency, business.country, i18n.language])
  const quantity = useCallback((milli: number) => formatQuantity(milli, i18n.language), [i18n.language])
  const day = useCallback((iso: string) => formatDay(iso, i18n.language), [i18n.language])
  // El servidor actualiza business.timezone/dayCutoff al instante aunque la regla sea futura: la jornada de hoy sale de la regla VIGENTE (dayRules).
  const rule = useCallback(() => activeRule(business.dayRules, new Date(), business), [business])
  const dateTime = useCallback((instant: string) => formatDateTime(instant, rule().timezone, i18n.language), [rule, i18n.language])
  const today = useCallback(() => {
    const r = rule()
    return businessDate(new Date(), r.timezone, r.cutoff)
  }, [rule])
  return { money, quantity, day, dateTime, today, presets: (now?: string) => presets(now ?? today()), currency: business.currency ?? 'USD', timezone: rule().timezone, cutoff: rule().cutoff }
}
