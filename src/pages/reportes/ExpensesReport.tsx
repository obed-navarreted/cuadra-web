import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Kpi, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { Bar, CsvButton } from './shared'
import { barPercent, share } from './logic'
import type { ExpenseReport } from './types'

type Category = NonNullable<ExpenseReport['byCategory']>[number]

/** Gastos del rango por categoría, separando lo que salió del cajón, las otras formas de pago y las compras de mercadería (que no cuentan en la ganancia). */
export function ExpensesReport({ businessId, range }: { businessId: string; range: DateRange }) {
  const { t } = useTranslation('reportes')
  const { money } = useFormat()
  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/expenses', { params: { path: { businessId }, query: { from: range.from, to: range.to } } })), [businessId, range.from, range.to])
  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  const e = state.data
  const rows = e.byCategory ?? []
  const total = rows.reduce((s, c) => s + c.amountMinor, 0)
  const max = Math.max(0, ...rows.map((c) => c.amountMinor))
  // Una categoría de fábrica se traduce por su clave; una creada por el negocio trae su propio nombre.
  const name = (c: Category) => c.name ?? (c.key ? t(`expenses.cat.${c.key}`, { defaultValue: c.key }) : t('expenses.uncategorized'))

  return (
    <div className="report">
      <section className="kpis">
        <Kpi label={t('expenses.operating')} value={money(e.operatingMinor)} />
        <Kpi label={t('expenses.purchases')} value={money(e.purchasesMinor)} hint={t('expenses.purchasesHint')} />
        <Kpi label={t('expenses.drawer')} value={money(e.cashDrawerMinor)} />
        <Kpi label={t('expenses.other')} value={money(e.otherMinor)} />
      </section>
      <Card title={t('tabs.expenses')} actions={<CsvButton path={`/api/b/${businessId}/reports/expenses.csv`} params={{ from: range.from, to: range.to }} />}>
        <DataTable
          columns={[
            { key: 'cat', header: t('expenses.category'), className: 'name-cell', cell: (c: Category) => name(c) },
            { key: 'amount', header: t('expenses.amount'), align: 'right', cell: (c) => money(c.amountMinor) },
            {
              key: 'share',
              header: t('expenses.share'),
              cell: (c) => (
                <span className="share-cell">
                  <Bar percent={barPercent(c.amountMinor, max)} tone="orange" label={`${share(c.amountMinor, total)} %`} />
                  <span>{share(c.amountMinor, total)} %</span>
                </span>
              ),
            },
          ]}
          rows={rows}
          rowKey={(c) => c.categoryId ?? c.key ?? 'none'}
          empty={t('expenses.empty')}
        />
      </Card>
    </div>
  )
}
