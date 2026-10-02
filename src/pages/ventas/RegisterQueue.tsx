import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { SaleRow } from './types'

type Item = NonNullable<SaleRow['items']>[number]

/**
 * «Por cobrar en caja» (docs/adr/0015), solo lectura: las cuentas que se enviaron a caja desde un teléfono y nadie ha cobrado. No son ventas hasta
 * cobrarse; se cobran (o anulan) en la app. Se muestra con el ajuste encendido o si quedó alguna pendiente.
 */
export function RegisterQueue({ businessId, enabled }: { businessId: string; enabled: boolean }) {
  const { t } = useTranslation('ventas')
  const { money, dateTime, quantity } = useFormat()
  const [open, setOpen] = useState<SaleRow | null>(null)
  const queue = useAsync(() => call(client.GET('/api/b/{businessId}/sales/register-queue', { params: { path: { businessId } } })), [businessId])
  const rows = Array.isArray(queue.data) ? queue.data : []
  if (!enabled && rows.length === 0) return null
  const total = rows.reduce((sum, r) => sum + r.totalMinor, 0)

  const columns: Column<SaleRow>[] = [
    { key: 'note', header: t('queue.note'), cell: (s) => <strong>{s.label ?? t('queue.noNote')}</strong> },
    { key: 'by', header: t('queue.by'), cell: (s) => s.sentBy?.name ?? s.createdBy?.name ?? '-' },
    { key: 'sent', header: t('queue.sent'), className: 'nowrap', cell: (s) => (s.sentToRegisterAt ? dateTime(s.sentToRegisterAt) : '-') },
    { key: 'items', header: t('queue.items'), align: 'right', cell: (s) => (s.items ?? []).length },
    { key: 'total', header: t('queue.total'), align: 'right', cell: (s) => <strong>{money(s.totalMinor)}</strong> },
  ]
  const itemColumns: Column<Item>[] = [
    { key: 'name', header: t('detail.product'), cell: (i) => [i.name, i.variant].filter(Boolean).join(' · ') },
    { key: 'qty', header: t('detail.quantity'), align: 'right', cell: (i) => quantity(i.quantityMilli) },
    { key: 'price', header: t('detail.price'), align: 'right', cell: (i) => money(i.unitPriceMinor) },
    { key: 'total', header: t('detail.lineTotal'), align: 'right', cell: (i) => <strong>{money(i.lineTotalMinor)}</strong> },
  ]

  return (
    <Card title={t('queue.title')} tone={rows.length > 0 ? 'orange' : undefined} actions={rows.length > 0 ? <Tag tone="orange">{t('queue.summary', { count: rows.length, amount: money(total) })}</Tag> : undefined}>
      <p className="muted">{t('queue.hint')}</p>
      {queue.error ? (
        <ErrorNotice error={queue.error} onRetry={queue.reload} />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t('queue.empty')} onRowClick={setOpen} />
      )}
      <Modal open={open !== null} title={t('queue.detailTitle')} onClose={() => setOpen(null)}>
        {open && (
          <div className="sale-detail">
            <dl>
              <dt>{t('queue.note')}</dt>
              <dd>{open.label ?? t('queue.noNote')}</dd>
              <dt>{t('detail.by')}</dt>
              <dd>{open.createdBy?.name ?? '-'}</dd>
              <dt>{t('detail.sentToRegister')}</dt>
              <dd>{t('detail.byAt', { name: open.sentBy?.name ?? '-', when: open.sentToRegisterAt ? dateTime(open.sentToRegisterAt) : '-' })}</dd>
            </dl>
            {open.lockedBy?.name && <p className="notice warn">{t('queue.lockedBy', { name: open.lockedBy.name })}</p>}
            <DataTable columns={itemColumns} rows={open.items ?? []} rowKey={(i) => i.id} empty={t('detail.noItems')} />
            <div className="sale-totals">
              {open.discountMinor > 0 && (
                <div>
                  <span>{t('detail.discount')}</span>
                  <span>−{money(open.discountMinor)}</span>
                </div>
              )}
              <div className="total">
                <span>{t('detail.total')}</span>
                <span>{money(open.totalMinor)}</span>
              </div>
            </div>
            <p className="muted small">{t('queue.hint')}</p>
            <div className="row">
              <Button onClick={() => setOpen(null)}>{t('detail.close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
