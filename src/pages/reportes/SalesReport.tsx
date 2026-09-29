import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Kpi, Spinner, Tabs } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { Bar, CsvButton } from './shared'
import { barPercent, share, type BreakdownRow } from './logic'

type By = 'member' | 'register' | 'method' | 'hour' | 'day'
const BY: By[] = ['member', 'register', 'method', 'hour', 'day']

/** Por si la respuesta no trajera el bloque de ventas (el contrato lo marca opcional): se muestra en ceros. */
const NO_SALES = { count: 0, totalMinor: 0, discountMinor: 0, averageTicketMinor: 0, cancelledCount: 0 }

/** Ventas del rango con totales y desglose por persona, caja, método de pago, hora o día. */
export function SalesReport({ businessId, range }: { businessId: string; range: DateRange }) {
  const { t } = useTranslation('reportes')
  const { money, day } = useFormat()
  const [by, setBy] = useState<By>('member')
  const q = { from: range.from, to: range.to }
  const state = useAsync(async () => {
    const [summary, rows] = await Promise.all([
      call(client.GET('/api/b/{businessId}/reports/sales', { params: { path: { businessId }, query: q } })),
      call(client.GET('/api/b/{businessId}/reports/sales/breakdown', { params: { path: { businessId }, query: { by, ...q } } })),
    ])
    return { sales: summary.sales ?? NO_SALES, rows }
  }, [businessId, range.from, range.to, by])

  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  const { sales, rows } = state.data
  const total = rows.reduce((s, r) => s + r.totalMinor, 0)
  const max = Math.max(0, ...rows.map((r) => r.totalMinor))
  const label = (r: BreakdownRow) => (by === 'method' ? t(`methods.${r.key}`, { defaultValue: r.label ?? '' }) : by === 'day' ? day(r.key ?? '') : (r.label ?? '—'))
  const base = `/api/b/${businessId}/reports`

  return (
    <div className="report">
      <section className="kpis">
        <Kpi label={t('sales.total')} value={money(sales.totalMinor)} />
        <Kpi label={t('sales.count')} value={sales.count} />
        <Kpi label={t('sales.ticket')} value={money(sales.averageTicketMinor)} />
        <Kpi label={t('sales.discount')} value={money(sales.discountMinor)} hint={t('sales.cancelled') + ': ' + sales.cancelledCount} />
      </section>
      <Card
        title={t(`sales.by.${by}`)}
        actions={
          <span className="report-actions">
            <CsvButton path={`${base}/sales/breakdown.csv`} params={{ by, ...q }} label={t('csv.breakdown')} />
            <CsvButton path={`${base}/sales.csv`} params={q} label={t('csv.sales')} />
            <CsvButton path={`${base}/sale-items.csv`} params={q} label={t('csv.items')} />
          </span>
        }
      >
        <Tabs value={by} onChange={setBy} items={BY.map((k) => ({ key: k, label: t(`sales.by.${k}`) }))} />
        <DataTable
          columns={[
            { key: 'group', header: t('sales.group'), className: 'name-cell', cell: (r: BreakdownRow) => label(r) },
            { key: 'n', header: t('sales.salesCount'), align: 'right', cell: (r) => r.count },
            { key: 'total', header: t('sales.amount'), align: 'right', cell: (r) => money(r.totalMinor) },
            { key: 'share', header: t('sales.share'), cell: (r) => <ShareCell percent={share(r.totalMinor, total)} bar={barPercent(r.totalMinor, max)} /> },
          ]}
          rows={rows}
          rowKey={(r) => r.key ?? r.label ?? ''}
          empty={t('sales.empty')}
        />
        {by === 'method' && <p className="report-note">{t('sales.methodNote')}</p>}
      </Card>
    </div>
  )
}

function ShareCell({ percent, bar }: { percent: number; bar: number }) {
  return (
    <span className="share-cell">
      <Bar percent={bar} label={`${percent} %`} />
      <span>{percent} %</span>
    </span>
  )
}
