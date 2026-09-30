import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { SaleTags } from './SaleTags'
import { canReturn, saleCost, saleInstant, type SalePayment, type SaleReturn, type SaleRow } from './types'

type Item = NonNullable<SaleRow['items']>[number]

/** Detalle de una venta: quién, cuándo, cada línea con su costo, cada pago (con vuelto) y el fiado que generó. */
export function SaleDetail({ sale, onClose, onCancel, onReturn }: { sale: SaleRow | null; onClose: () => void; onCancel: (s: SaleRow) => void; onReturn?: (s: SaleRow) => void }) {
  const { t } = useTranslation('ventas')
  const { money, quantity, dateTime } = useFormat()
  const items = sale?.items ?? []
  const payments = sale?.payments ?? []
  const { cost, coveragePercent } = saleCost(items)

  const itemColumns: Column<Item>[] = [
    { key: 'name', header: t('detail.product'), cell: (i) => [i.name, i.variant].filter(Boolean).join(' · ') },
    { key: 'qty', header: t('detail.quantity'), align: 'right', cell: (i) => quantity(i.quantityMilli) },
    { key: 'price', header: t('detail.price'), align: 'right', cell: (i) => money(i.unitPriceMinor) },
    { key: 'cost', header: t('detail.cost'), align: 'right', cell: (i) => (i.unitCostMinor == null ? <span className="muted">—</span> : money(i.unitCostMinor)) },
    { key: 'total', header: t('detail.lineTotal'), align: 'right', cell: (i) => <strong>{money(i.lineTotalMinor)}</strong> },
    ...((sale?.returnedMinor ?? 0) > 0
      ? [{ key: 'returned', header: t('detail.returned'), align: 'right' as const, cell: (i: Item) => (i.returnedMilli > 0 ? quantity(i.returnedMilli) : <span className="muted">—</span>) }]
      : []),
  ]
  const refundText = (r: SaleReturn) =>
    (r.refunds ?? []).map((f) => `${f.method === 'CREDIT' ? t('return.creditNote') : t(`method.${f.method}`, { defaultValue: f.method })} ${money(f.amountMinor)}`).join(' · ')
  const paymentColumns: Column<SalePayment>[] = [
    { key: 'method', header: t('detail.method'), cell: (p) => (p.method === 'OTHER' && p.otherLabel ? p.otherLabel : t(`method.${p.method}`, { defaultValue: p.method })) },
    { key: 'amount', header: t('detail.amount'), align: 'right', cell: (p) => money(p.amountMinor) },
    {
      key: 'note',
      header: t('detail.note'),
      cell: (p) =>
        p.method === 'CREDIT' ? (
          <Tag tone="orange">{t('detail.creditTo', { name: p.debtorLabel ?? '—' })}</Tag>
        ) : p.changeMinor ? (
          t('detail.change', { tendered: money(p.tenderedMinor ?? 0), change: money(p.changeMinor) })
        ) : (
          (p.reference ?? '')
        ),
    },
  ]

  return (
    <Modal open={sale !== null} title={t('detail.title')} onClose={onClose}>
      {sale && (
        <div className="sale-detail">
          <div className="row">
            {sale.status === 'CANCELLED' ? <Tag tone="red">{t('status.CANCELLED')}</Tag> : <Tag tone="green">{t('status.COMPLETED')}</Tag>}
            {sale.editedAt && <Tag>{t('detail.edited')}</Tag>}
            <SaleTags sale={sale} />
          </div>
          <dl>
            <dt>{t('detail.date')}</dt>
            <dd>{saleInstant(sale) ? dateTime(saleInstant(sale) as string) : '—'}</dd>
            <dt>{t('detail.by')}</dt>
            <dd>{sale.completedBy?.name ?? sale.createdBy?.name ?? '—'}</dd>
            {sale.editedAt && (
              <>
                <dt>{t('detail.editedBy')}</dt>
                <dd>{t('detail.byAt', { name: sale.editedBy?.name ?? '—', when: dateTime(sale.editedAt) })}</dd>
              </>
            )}
            {sale.status === 'CANCELLED' && (
              <>
                <dt>{t('detail.cancelledBy')}</dt>
                <dd>{t('detail.byAt', { name: sale.cancelledBy?.name ?? '—', when: sale.cancelledAt ? dateTime(sale.cancelledAt) : '—' })}</dd>
                <dt>{t('detail.reason')}</dt>
                <dd>{sale.cancelReason ?? '—'}</dd>
              </>
            )}
          </dl>
          <DataTable columns={itemColumns} rows={items} rowKey={(i) => i.id} empty={t('detail.noItems')} />
          <DataTable columns={paymentColumns} rows={payments} rowKey={(p) => p.id} empty={t('detail.noPayments')} />
          {(sale.returns ?? []).length > 0 && (
            <div className="sale-returns">
              <h3>{t('detail.returnsTitle')}</h3>
              {(sale.returns ?? []).map((r) => (
                <div key={r.id} className="sale-return">
                  <div className="row between">
                    <strong>{t('detail.returnLine', { when: r.occurredAt ? dateTime(r.occurredAt) : '—', name: r.createdBy?.name ?? '—' })}</strong>
                    <strong>−{money(r.totalMinor)}</strong>
                  </div>
                  <div className="muted small">{(r.items ?? []).map((i) => `${quantity(i.quantityMilli)} × ${i.name}`).join(', ')}</div>
                  <div className="muted small">{refundText(r)}</div>
                  <div className="muted small">{t('detail.reasonLine', { reason: r.reason })}</div>
                </div>
              ))}
            </div>
          )}
          <div className="sale-totals">
            <div>
              <span>{t('detail.subtotal')}</span>
              <span>{money(sale.subtotalMinor)}</span>
            </div>
            {sale.discountMinor > 0 && (
              <div>
                <span>{t('detail.discount')}</span>
                <span>−{money(sale.discountMinor)}</span>
              </div>
            )}
            <div className="total">
              <span>{t('detail.total')}</span>
              <span>{money(sale.totalMinor)}</span>
            </div>
            {(sale.returnedMinor ?? 0) > 0 && (
              <div>
                <span>{t('detail.returnedTotal')}</span>
                <span>−{money(sale.returnedMinor)}</span>
              </div>
            )}
            <div className="muted">
              <span>{t('detail.costOfGoods')}</span>
              <span>{money(cost)}</span>
            </div>
            {coveragePercent < 100 && <span className="muted small">{t('detail.costCoverage', { percent: coveragePercent })}</span>}
          </div>
          <div className="row">
            <Button onClick={onClose}>{t('detail.close')}</Button>
            {onReturn && canReturn(sale) && (
              <Button kind="primary" onClick={() => onReturn(sale)}>
                {t('detail.return')}
              </Button>
            )}
            {sale.status === 'COMPLETED' && (sale.returns ?? []).length === 0 && (
              <Button kind="danger" onClick={() => onCancel(sale)}>
                {t('detail.cancel')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
