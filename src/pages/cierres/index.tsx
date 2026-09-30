import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { RangePicker } from '../../components/RangePicker'
import { ErrorNotice, Kpi, Page, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { DayCard } from './DayCard'
import { isEmptyDay, syncWarningKind, totals, windowLocale, windowText, zoneFor, type DayClose } from './logic'
import './cierres.css'

/**
 * Cierre del día: el cierre es automático por jornada del negocio (de la hora de corte de un día a la del siguiente). Una tarjeta por día con su
 * ventana exacta y lo que debe haber en efectivo; nada se abre, se cuenta ni se cierra a mano.
 */
export default function CierresPage() {
  const { t, i18n } = useTranslation('cierres')
  const { business } = useBusiness()
  const businessId = business.id
  const { money, day, today, timezone, dateTime } = useFormat()
  const [range, setRange] = useState<DateRange>(() => ({ from: today(), to: today() }))

  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/daily-close', { params: { path: { businessId }, query: { from: range.from, to: range.to } } })), [businessId, range.from, range.to])

  // Lo más reciente primero.
  const days = useMemo<DayClose[]>(() => [...(state.data?.days ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [state.data])
  const sum = useMemo(() => totals(days), [days])

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <div className="cierres-filters">
        <RangePicker value={range} onChange={setRange} />
      </div>
      {state.error ? (
        <ErrorNotice error={state.error} onRetry={state.reload} />
      ) : state.loading && !state.data ? (
        <Spinner />
      ) : days.length === 0 ? (
        <p className="muted">{t('empty')}</p>
      ) : (
        <>
          {(state.data?.syncWarnings ?? []).map((w) => (
            <p key={w.deviceId} className="notice warn" role="status">
              {syncWarningKind(w) === 'PENDING'
                ? t('sync.pending', { count: w.pendingOps, device: w.name })
                : t('sync.stale', { device: w.name, when: w.lastSyncAt ? dateTime(w.lastSyncAt) : '—' })}
            </p>
          ))}
          <div className="kpis compact">
            <Kpi label={t('kpi.days')} value={sum.days} />
            <Kpi label={t('kpi.sales')} value={money(sum.salesMinor)} hint={t('sales.count', { count: sum.salesCount })} />
            <Kpi label={t('kpi.expected')} value={money(sum.expectedCashMinor)} hint={t('kpi.expectedHint')} />
            <Kpi label={t('kpi.cancelled')} value={sum.cancelledCount} tone={sum.cancelledCount > 0 ? 'orange' : undefined} hint={sum.cancelledCount > 0 ? money(sum.cancelledMinor) : undefined} />
          </div>
          {days.length > 1 && <DayCard title={t('total', { count: days.length })} figures={sum} />}
          {days.map((d) => (
            <DayCard
              key={d.date}
              title={d.date ? day(d.date) : '—'}
              window={d.startsAt && d.endsAt ? windowText(d.startsAt, d.endsAt, zoneFor(d.date, business.dayRules, timezone), windowLocale(i18n.language, business.country)) : undefined}
              figures={d}
              muted={isEmptyDay(d)}
            />
          ))}
        </>
      )}
    </Page>
  )
}
