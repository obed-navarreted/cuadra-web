import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { RangePicker } from '../../components/RangePicker'
import { Card, EmptyState, ErrorNotice, Kpi, Page, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { coverageIncomplete, barPercent } from '../reportes/logic'
import { Bar, Difference } from '../reportes/shared'
import type { Debtor, ReportProduct } from '../reportes/types'
import { SalesExpensesChart } from './SalesExpensesChart'
import './resumen.css'

/** Resumen del negocio (PLAN.md 9.1): las cifras que el dueño mira primero. Todo sale de /reports/overview y /reports/receivables, la misma fuente de Reportes. */
export default function ResumenPage() {
  const { t } = useTranslation('resumen')
  const { t: tc } = useTranslation()
  const { business } = useBusiness()
  const { money, day, dateTime, presets } = useFormat()
  const [range, setRange] = useState<DateRange>(() => presets().last7)

  const overview = useAsync(
    () => call(client.GET('/api/b/{businessId}/reports/overview', { params: { path: { businessId: business.id }, query: { from: range.from, to: range.to } } })),
    [business.id, range.from, range.to],
  )
  const receivables = useAsync(() => call(client.GET('/api/b/{businessId}/reports/receivables', { params: { path: { businessId: business.id } } })), [business.id])

  const o = overview.data
  const sales = o?.sales
  const profit = o?.profit
  const maxRevenue = Math.max(0, ...(o?.topProducts ?? []).map((p) => p.revenueMinor))
  const oldest: Debtor[] = [...(receivables.data?.worst ?? [])].sort((a, b) => b.oldestDays - a.oldestDays).slice(0, 5)
  const closing = o?.lastClosing
  const line = closing?.lines?.[0]

  return (
    <Page title={tc('nav.resumen')} subtitle={t('subtitle', { from: day(range.from), to: day(range.to) })}>
      <RangePicker value={range} onChange={setRange} />
      {overview.error && <ErrorNotice error={overview.error} onRetry={overview.reload} />}
      {!o && overview.loading && <Spinner />}
      {o && sales && profit && (
        <>
          <section className="kpis" aria-label={tc('nav.resumen')}>
            <Kpi label={t('kpi.sales')} value={money(sales.totalMinor)} hint={t('kpi.salesHint', { count: sales.count, ticket: money(sales.averageTicketMinor) })} />
            <Kpi
              label={t('kpi.expenses')}
              value={money(profit.operatingExpensesMinor)}
              hint={profit.purchasesExcludedMinor > 0 ? t('kpi.expensesHint', { amount: money(profit.purchasesExcludedMinor) }) : t('kpi.expensesHintNone')}
            />
            <Kpi label={t('kpi.profit')} value={money(profit.estimatedProfitMinor)} hint={t('kpi.profitHint')} tone={profit.estimatedProfitMinor >= 0 ? 'green' : 'red'} />
            <Kpi
              label={t('kpi.receivable')}
              value={money(o.receivableMinor)}
              hint={receivables.data ? t('kpi.receivableHint', { count: receivables.data.openCount }) : undefined}
              tone="orange"
            />
          </section>
          {coverageIncomplete(profit.costCoveragePercent) && sales.totalMinor > 0 && <p className="coverage-note">{t('kpi.coverage', { percent: profit.costCoveragePercent })}</p>}

          <div className="grid-2">
            <div className="resumen-cols">
              <Card title={t('chart.title')}>
                <SalesExpensesChart series={o.series ?? []} />
              </Card>
              <Card title={t('top.title')} actions={<span className="muted small">{t('top.legend')}</span>}>
                <TopProducts products={o.topProducts ?? []} max={maxRevenue} />
              </Card>
            </div>
            <div className="resumen-cols">
              <Card title={t('oldest.title')} actions={<Link className="section-link small" to="/reportes?tab=receivables">{t('oldest.all')}</Link>}>
                {receivables.error && <ErrorNotice error={receivables.error} onRetry={receivables.reload} />}
                {oldest.length === 0 && !receivables.error && <EmptyState>{t('oldest.empty')}</EmptyState>}
                {oldest.map((d) => (
                  <div className="list-row" key={d.customerId ?? d.name}>
                    <span className="name-cell">
                      <strong>{d.name ?? '—'}</strong>
                      <span className="muted small"> · {t('oldest.days', { count: d.oldestDays })}</span>
                    </span>
                    <span className="amounts">{money(d.balanceMinor)}</span>
                  </div>
                ))}
              </Card>
              <Card title={t('stock.title')}>
                <p>{o.lowStockCount > 0 ? t('stock.low', { count: o.lowStockCount }) : t('stock.ok')}</p>
                <Link className="section-link" to="/inventario">
                  {t('stock.link')}
                </Link>
              </Card>
              <Card title={t('closing.title')}>
                {closing && line ? (
                  <>
                    <p>{t('closing.by', { name: closing.name ?? '—', when: line.closedAt ? dateTime(line.closedAt) : '' })}</p>
                    <div>
                      <Difference minor={line.differenceMinor} />
                    </div>
                    <Link className="section-link" to="/cierres">
                      {t('closing.link')}
                    </Link>
                  </>
                ) : (
                  <EmptyState>{t('closing.empty')}</EmptyState>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </Page>
  )
}

function TopProducts({ products, max }: { products: ReportProduct[]; max: number }) {
  const { t } = useTranslation('resumen')
  const { money } = useFormat()
  if (products.length === 0) return <EmptyState>{t('top.empty')}</EmptyState>
  return (
    <div>
      {products.map((p) => (
        <div className="list-row" key={p.productId ?? p.name}>
          <span className="name-cell">
            <strong>{p.name}</strong>
          </span>
          <span className="amounts">
            {money(p.revenueMinor)}
            <small>{p.fullyCosted || p.profitMinor !== 0 ? money(p.profitMinor) : t('top.noCost')}</small>
          </span>
          <Bar percent={barPercent(p.revenueMinor, max)} label={`${p.name}: ${money(p.revenueMinor)}`} />
        </div>
      ))}
    </div>
  )
}
