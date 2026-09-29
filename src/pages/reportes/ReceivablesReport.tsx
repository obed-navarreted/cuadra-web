import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Kpi, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { Bar, CsvButton } from './shared'
import { barPercent } from './logic'
import type { Debtor } from './types'

/** Lo que se debe al negocio hoy: antigüedad en cuatro tramos y quiénes más deben / mejor pagan. */
export function ReceivablesReport({ businessId }: { businessId: string }) {
  const { t } = useTranslation('reportes')
  const { money } = useFormat()
  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/receivables', { params: { path: { businessId } } })), [businessId])
  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  const r = state.data
  const buckets = r.buckets ?? []
  const max = Math.max(0, ...buckets.map((b) => b.amountMinor))

  // En "quienes más deben" importa lo que deben; en "mejores pagadores", lo que pagaron: cada tabla pone primero su columna.
  const table = (rows: Debtor[], empty: string, paidFirst = false) => {
    const owes = { key: 'owes', header: t('receivables.owes'), align: 'right' as const, cell: (d: Debtor) => money(d.balanceMinor) }
    const oldest = { key: 'oldest', header: t('receivables.oldest'), align: 'right' as const, cell: (d: Debtor) => t('receivables.days', { count: d.oldestDays }) }
    const paid = { key: 'paid', header: t('receivables.paid'), align: 'right' as const, cell: (d: Debtor) => money(d.paidLast90Minor) }
    return <DataTable
      columns={[{ key: 'name', header: t('receivables.name'), className: 'name-cell', cell: (d: Debtor) => d.name ?? '—' }, ...(paidFirst ? [paid, owes, oldest] : [owes, oldest, paid])]}
      rows={rows}
      rowKey={(d) => d.customerId ?? d.name ?? ''}
      empty={empty}
    />
  }

  return (
    <div className="report">
      <section className="kpis">
        <Kpi label={t('receivables.total')} value={money(r.totalMinor)} hint={t('receivables.count', { count: r.openCount })} tone="orange" />
      </section>
      <Card title={t('receivables.aging')} actions={<CsvButton path={`/api/b/${businessId}/reports/receivables.csv`} />}>
        {buckets.map((b) => (
          <div className="list-row" key={b.key ?? b.fromDays}>
            <span>
              <strong>{t(`receivables.bucket.${b.key}`, { defaultValue: b.key ?? '' })}</strong>
              <span className="muted small"> · {t('receivables.bucketCount', { count: b.count })}</span>
            </span>
            <span className="amounts">{money(b.amountMinor)}</span>
            <Bar percent={barPercent(b.amountMinor, max)} tone="orange" label={`${money(b.amountMinor)}`} />
          </div>
        ))}
      </Card>
      <Card title={t('receivables.worst')}>{table(r.worst ?? [], t('receivables.empty'))}</Card>
      <Card title={t('receivables.best')}>{table(r.best ?? [], t('receivables.noPayers'), true)}</Card>
    </div>
  )
}
