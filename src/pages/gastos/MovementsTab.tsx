import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Pager } from '../../components/Pager'
import { ReasonDialog } from '../../components/ReasonDialog'
import { Button, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import type { CashMovement } from './types'

const PAGE_SIZE = 50

/** Entradas y retiros de efectivo del cajón (no son gastos: por eso están aparte). Se pueden anular; no se editan. */
export function MovementsTab({ range }: { range: DateRange }) {
  const { t } = useTranslation('gastos')
  const { business } = useBusiness()
  const businessId = business.id
  const { money, dateTime } = useFormat()
  const [page, setPage] = useState(0)
  const [toVoid, setToVoid] = useState<CashMovement | null>(null)
  const list = useAsync(
    async () => (await call(client.GET('/api/b/{businessId}/cash-movements', { params: { path: { businessId }, query: { from: range.from, to: range.to, page, size: PAGE_SIZE } } }))),
    [businessId, range.from, range.to, page],
  )
  const columns: Column<CashMovement>[] = [
    { key: 'date', header: t('col.date'), className: 'nowrap', cell: (m) => (m.occurredAt ? dateTime(m.occurredAt) : '—') },
    { key: 'kind', header: t('col.kind'), cell: (m) => <Tag tone={m.kind === 'DEPOSIT' ? 'green' : 'orange'}>{t(`movement.${m.kind}`, { defaultValue: m.kind })}</Tag> },
    { key: 'reason', header: t('col.reason'), cell: (m) => m.reason ?? <span className="muted">—</span> },
    { key: 'by', header: t('col.by'), cell: (m) => m.createdByName ?? '—' },
    { key: 'amount', header: t('col.amount'), align: 'right', cell: (m) => <strong>{m.kind === 'DEPOSIT' ? '+' : '−'}{money(m.amountMinor)}</strong> },
    { key: 'act', header: t('col.actions'), cell: (m) => (m.voided ? <Tag tone="red">{t('voided')}</Tag> : <Button small onClick={() => setToVoid(m)}>{t('void.action')}</Button>) },
  ]
  return (
    <>
      <p className="muted">{t('movements.hint')}</p>
      {list.error ? (
        <ErrorNotice error={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <Spinner />
      ) : (
        <>
          <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(m) => m.id} empty={t('movements.empty')} />
          <Pager page={page} size={PAGE_SIZE} total={list.data?.total ?? 0} onChange={setPage} />
        </>
      )}
      <ReasonDialog
        open={toVoid !== null}
        title={t('movements.voidTitle')}
        body={t('movements.voidBody', { amount: toVoid ? money(toVoid.amountMinor) : '' })}
        confirmLabel={t('void.confirm')}
        onClose={() => setToVoid(null)}
        onConfirm={async (reason) => {
          if (!toVoid) return
          await call(client.POST('/api/b/{businessId}/cash-movements/{movementId}/void', { params: { path: { businessId, movementId: toVoid.id } }, body: { reason: reason || undefined } }))
          list.reload()
        }}
      />
    </>
  )
}
