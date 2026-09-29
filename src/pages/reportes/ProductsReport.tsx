import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Spinner, Tabs, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { CsvButton } from './shared'
import type { ReportProduct } from './types'

type Sort = 'revenue' | 'quantity' | 'profit'
const SORTS: Sort[] = ['revenue', 'quantity', 'profit']
const LIMIT = 200

/** Productos vendidos con ingreso, costo y ganancia; marca los que se vendieron alguna vez sin costo anotado. */
export function ProductsReport({ businessId, range }: { businessId: string; range: DateRange }) {
  const { t } = useTranslation('reportes')
  const { money, quantity } = useFormat()
  const [sort, setSort] = useState<Sort>('revenue')
  const state = useAsync(
    () => call(client.GET('/api/b/{businessId}/reports/products', { params: { path: { businessId }, query: { sort, limit: LIMIT, from: range.from, to: range.to } } })),
    [businessId, range.from, range.to, sort],
  )
  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  return (
    <Card
      title={t('tabs.products')}
      actions={<CsvButton path={`/api/b/${businessId}/reports/products.csv`} params={{ sort, limit: LIMIT, from: range.from, to: range.to }} />}
    >
      <Tabs value={sort} onChange={setSort} items={SORTS.map((k) => ({ key: k, label: t(`products.sort.${k}`) }))} />
      <DataTable
        columns={[
          {
            key: 'name',
            header: t('products.name'),
            className: 'name-cell',
            cell: (p: ReportProduct) => (
              <>
                {p.name}
                {!p.fullyCosted && (
                  <>
                    {' '}
                    <Tag tone="orange">{t('products.noCost')}</Tag>
                  </>
                )}
              </>
            ),
          },
          { key: 'q', header: t('products.quantity'), align: 'right', cell: (p) => quantity(p.quantityMilli) },
          { key: 'r', header: t('products.revenue'), align: 'right', cell: (p) => money(p.revenueMinor) },
          { key: 'c', header: t('products.cost'), align: 'right', cell: (p) => money(p.costMinor) },
          { key: 'p', header: t('products.profit'), align: 'right', cell: (p) => <strong>{money(p.profitMinor)}</strong> },
        ]}
        rows={state.data}
        rowKey={(p) => p.productId ?? `n:${p.name}`}
        empty={t('products.empty')}
      />
    </Card>
  )
}
