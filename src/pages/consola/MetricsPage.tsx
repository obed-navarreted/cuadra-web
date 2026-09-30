import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, ErrorNotice, Kpi, Page, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { getMetrics, type Metrics } from './api'
import { useConsoleFormat } from './format'
import { cohortRow, fillDays, planKeyLabel, SHOW_PLANS } from './lib'

type Count = { key?: string | null; count: number }

/** Barras horizontales con la parte de cada valor (solo CSS). */
function Distribution({ title, rows, label }: { title: string; rows: Count[]; label: (key: string) => string }) {
  const { t } = useTranslation('consola')
  const { number } = useConsoleFormat()
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="muted">{t('metrics.noData')}</p>
      ) : (
        <ul className="dist">
          {rows.map((r) => (
            <li key={r.key ?? '-'}>
              <span className="dist-label">{label(r.key ?? '-')}</span>
              <span className="dist-bar" aria-hidden="true">
                <span style={{ width: `${total ? Math.max(2, (r.count / total) * 100) : 0}%` }} />
              </span>
              <span className="dist-n">{number(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Ventas por día de los últimos 30 días, en SVG simple. */
function SalesChart({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation('consola')
  const { number, date } = useConsoleFormat()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const days = useMemo(() => fillDays(metrics.salesPerDay ?? [], today, 30), [metrics.salesPerDay, today])
  const max = Math.max(1, ...days.map((d) => d.sales))
  const total = days.reduce((s, d) => s + d.sales, 0)
  const W = 600
  const H = 140
  const step = W / days.length
  return (
    <Card title={t('metrics.salesPerDay')}>
      <svg className="chart" viewBox={`0 0 ${W} ${H + 4}`} role="img" aria-label={t('metrics.salesSummary', { total: number(total), days: days.length })} preserveAspectRatio="none">
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line-2)" />
        {days.map((d, i) => {
          const h = d.sales === 0 ? 0 : Math.max(2, (d.sales / max) * (H - 6))
          return (
            <rect key={d.day} x={i * step + 1.5} y={H - h} width={Math.max(1, step - 3)} height={h} rx="2" fill="var(--series-sales)">
              <title>{`${date(`${d.day}T12:00:00Z`)}: ${t('metrics.salesDay', { sales: number(d.sales), businesses: number(d.businesses) })}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="row muted small">
        <span>{date(`${days[0].day}T12:00:00Z`)}</span>
        <span className="grow" />
        <span>{t('metrics.peak', { n: number(max === 1 && total === 0 ? 0 : max) })}</span>
        <span className="grow" />
        <span>{date(`${days[days.length - 1].day}T12:00:00Z`)}</span>
      </div>
    </Card>
  )
}

function Retention({ metrics }: { metrics: Metrics }) {
  const { t } = useTranslation('consola')
  const { date } = useConsoleFormat()
  const [now] = useState(() => Date.now())
  const rows = (metrics.retention ?? []).map((c) => cohortRow(c, now))
  const cols = Math.max(0, ...rows.map((r) => r.cells.length))
  return (
    <Card title={t('metrics.retention')}>
      <p className="muted small">{t('metrics.retentionHint')}</p>
      {rows.length === 0 ? (
        <p className="muted">{t('metrics.noData')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data retention">
            <thead>
              <tr>
                <th scope="col">{t('metrics.cohort')}</th>
                <th scope="col" className="right">
                  {t('metrics.cohortSize')}
                </th>
                {Array.from({ length: cols }, (_, k) => (
                  <th key={k} scope="col" className="right">
                    {t('metrics.weekN', { n: k })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week}>
                  <th scope="row">{date(`${r.week}T12:00:00Z`)}</th>
                  <td className="right">{r.size}</td>
                  {Array.from({ length: cols }, (_, k) => {
                    const pct = r.cells[k]
                    return pct === undefined ? (
                      <td key={k} />
                    ) : (
                      <td key={k} className="right heat" style={{ background: `color-mix(in srgb, var(--green) ${pct}%, var(--surface))`, color: pct >= 55 ? '#fff' : 'var(--ink)' }}>
                        {pct}%
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function MetricsPage() {
  const { t } = useTranslation('consola')
  const { number, country, language, orNone } = useConsoleFormat()
  const m = useAsync(getMetrics, [])
  const d = m.data
  return (
    <Page title={t('nav.metrics')} subtitle={t('metrics.subtitle')}>
      {m.error && <ErrorNotice error={m.error} onRetry={m.reload} />}
      {!d && !m.error && <Spinner />}
      {d && (
        <>
          <div className="kpis">
            <Kpi label={t('metrics.businesses')} value={number(d.businesses)} />
            <Kpi label={t('metrics.created7')} value={number(d.createdLast7)} />
            <Kpi label={t('metrics.created30')} value={number(d.createdLast30)} />
            <Kpi label={t('metrics.active7')} value={number(d.active7)} tone="green" hint={t('metrics.activeHint')} />
            <Kpi label={t('metrics.active30')} value={number(d.active30)} tone="green" hint={t('metrics.activeHint')} />
            <Kpi label={t('metrics.users')} value={number(d.users)} />
            <Kpi label={t('metrics.devices')} value={number(d.devices)} />
          </div>
          <SalesChart metrics={d} />
          <div className="dist-grid">
            <Distribution title={t('metrics.byCountry')} rows={d.byCountry ?? []} label={(k) => country(k)} />
            <Distribution title={t('metrics.byType')} rows={d.byType ?? []} label={(k) => orNone(k)} />
            <Distribution title={t('metrics.byLocale')} rows={d.byLocale ?? []} label={(k) => language(k)} />
            {SHOW_PLANS && <Distribution title={t('metrics.byPlan')} rows={d.byPlan ?? []} label={(k) => planKeyLabel(k, t)} />}
            <Distribution title={t('metrics.moduleUsage')} rows={d.moduleUsage ?? []} label={(k) => t(`modules.${k}`, { defaultValue: k })} />
            <Distribution title={t('metrics.appVersions')} rows={d.appVersions ?? []} label={(k) => orNone(k)} />
          </div>
          <Retention metrics={d} />
        </>
      )}
    </Page>
  )
}
