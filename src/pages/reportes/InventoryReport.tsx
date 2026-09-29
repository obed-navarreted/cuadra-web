import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Kpi, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { CsvButton } from './shared'
import type { StockLine } from './types'

/** Inventario de hoy: valor al costo, lo que hay que revisar y lo que no se mueve hace 30 días. */
export function InventoryReport({ businessId }: { businessId: string }) {
  const { t } = useTranslation('reportes')
  const { money, quantity } = useFormat()
  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/inventory', { params: { path: { businessId } } })), [businessId])
  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  const inv = state.data

  const stock = (l: StockLine) => (
    <>
      {quantity(l.stockMilli)} {t(`units.${l.unit}`, { defaultValue: l.unit ?? '' })}
      {l.stockMilli < 0 && (
        <>
          {' '}
          <Tag tone="red">{t('inventory.negative')}</Tag>
        </>
      )}
    </>
  )
  const name = { key: 'name', header: t('inventory.name'), className: 'name-cell', cell: (l: StockLine) => l.name ?? '—' }

  return (
    <div className="report">
      <section className="kpis">
        <Kpi label={t('inventory.value')} value={money(inv.valueAtCostMinor)} hint={t('inventory.valueHint')} tone="green" />
        <Kpi label={t('inventory.tracked')} value={inv.trackedCount} />
        <Kpi label={t('inventory.noCost')} value={inv.trackedWithoutCost} hint={t('inventory.noCostHint')} tone={inv.trackedWithoutCost > 0 ? 'orange' : undefined} />
      </section>
      <Card title={t('inventory.low')} actions={<CsvButton path={`/api/b/${businessId}/reports/inventory.csv`} />}>
        <DataTable
          columns={[
            name,
            { key: 'stock', header: t('inventory.stock'), align: 'right', cell: stock },
            { key: 'min', header: t('inventory.min'), align: 'right', cell: (l) => (l.minStockMilli == null ? '—' : quantity(l.minStockMilli)) },
          ]}
          rows={inv.low ?? []}
          rowKey={(l) => l.productId ?? l.name ?? ''}
          empty={t('inventory.emptyLow')}
        />
      </Card>
      <Card title={t('inventory.idle')}>
        <DataTable
          columns={[
            name,
            { key: 'stock', header: t('inventory.stock'), align: 'right', cell: stock },
            { key: 'cost', header: t('inventory.cost'), align: 'right', cell: (l) => (l.costMinor == null ? '—' : money(l.costMinor)) },
            { key: 'last', header: t('inventory.lastSale'), align: 'right', cell: (l) => (l.daysSinceLastSale == null ? t('inventory.never') : t('inventory.daysAgo', { count: l.daysSinceLastSale })) },
          ]}
          rows={inv.noMovement ?? []}
          rowKey={(l) => l.productId ?? l.name ?? ''}
          empty={t('inventory.emptyIdle')}
        />
      </Card>
    </div>
  )
}
