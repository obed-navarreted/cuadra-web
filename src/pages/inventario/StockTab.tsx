import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadFile } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Kpi, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { addMovement, loadMovements, loadProducts, loadStockReport } from './api'
import { errorMessage, newId } from './errors'
import { needsReview } from './productDraft'
import { parseQuantity } from './quantity'
import type { Product, StockLine } from './types'

/** Existencias: cuánto vale lo que hay, qué hay que revisar, y contar / dar de baja / registrar devoluciones por producto. Solo productos con control. */
export function StockTab({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const { t, i18n } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const [onlyReview, setOnlyReview] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [exportError, setExportError] = useState<unknown>(null)
  const report = useAsync(() => loadStockReport(business.id), [business.id, reloadKey])
  const products = useAsync(() => loadProducts(business.id), [business.id, reloadKey])
  const tracked = useMemo(() => (products.data ?? []).filter((p) => p.trackStock && (!onlyReview || needsReview(p))), [products.data, onlyReview])

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: t('products.col.name'),
      cell: (p) => (
        <div>
          <strong>{p.name}</strong>
          {p.variant && <span className="muted"> · {p.variant}</span>}
        </div>
      ),
    },
    {
      key: 'stock',
      header: t('products.col.stock'),
      align: 'right',
      cell: (p) => (
        <span className={p.stockMilli < 0 ? 'inv-negative' : needsReview(p) ? 'inv-low' : undefined}>
          {fmt.quantity(p.stockMilli)} {t(`units.${p.unit ?? 'UNIT'}`)}
        </span>
      ),
    },
    { key: 'min', header: t('stock.min'), align: 'right', cell: (p) => (p.minStockMilli == null ? <span className="muted">—</span> : fmt.quantity(p.minStockMilli)) },
    { key: 'value', header: t('stock.value'), align: 'right', cell: (p) => (p.costMinor == null || p.stockMilli <= 0 ? <span className="muted">—</span> : fmt.money(Math.floor((p.costMinor * p.stockMilli + 500) / 1000))) },
    { key: 'state', header: '', cell: (p) => (p.stockMilli < 0 ? <Tag tone="red">{t('stock.negative')}</Tag> : needsReview(p) ? <Tag tone="orange">{t('stock.low')}</Tag> : null) },
  ]
  const idleColumns: Column<StockLine>[] = [
    { key: 'name', header: t('products.col.name'), cell: (l) => l.name },
    { key: 'stock', header: t('products.col.stock'), align: 'right', cell: (l) => `${fmt.quantity(l.stockMilli)} ${t(`units.${l.unit ?? 'UNIT'}`)}` },
    { key: 'days', header: t('stock.lastSale'), align: 'right', cell: (l) => (l.daysSinceLastSale == null ? t('stock.never') : t('stock.daysAgo', { count: l.daysSinceLastSale })) },
  ]

  const data = report.data
  return (
    <div className="inv-stack">
      {report.error && <ErrorNotice error={report.error} onRetry={report.reload} />}
      {data && (
        <div className="kpis">
          <Kpi label={t('stock.valueAtCost')} value={fmt.money(data.valueAtCostMinor)} hint={t('stock.valueHint')} tone="green" />
          <Kpi label={t('stock.tracked')} value={data.trackedCount} hint={data.trackedWithoutCost > 0 ? t('stock.withoutCost', { count: data.trackedWithoutCost }) : undefined} />
          <Kpi label={t('stock.toReview')} value={data.low?.length ?? 0} tone={(data.low?.length ?? 0) > 0 ? 'orange' : undefined} hint={t('stock.toReviewHint')} />
        </div>
      )}
      <Card
        title={t('stock.title')}
        actions={
          <>
            <Button small kind={onlyReview ? 'dark' : 'plain'} onClick={() => setOnlyReview((v) => !v)} aria-pressed={onlyReview}>
              {t('stock.onlyReview')}
            </Button>
            <Button small onClick={() => downloadFile(`/api/b/${business.id}/reports/inventory.csv`, { lang: i18n.language }).then(() => setExportError(null), setExportError)}>
              {t('stock.export')}
            </Button>
          </>
        }
      >
        {exportError !== null && <div className="notice error" role="alert">{errorMessage(t, exportError)}</div>}
        {products.error ? <ErrorNotice error={products.error} onRetry={products.reload} /> : products.loading && !products.data ? <Spinner /> : <DataTable columns={columns} rows={tracked} rowKey={(p) => p.id} empty={t('stock.empty')} onRowClick={setSelected} />}
      </Card>
      {(data?.noMovement?.length ?? 0) > 0 && (
        <Card title={t('stock.idleTitle')}>
          <p className="muted small">{t('stock.idleHint')}</p>
          <DataTable columns={idleColumns} rows={data?.noMovement ?? []} rowKey={(l) => l.productId ?? l.name ?? ''} empty="" />
        </Card>
      )}
      {selected && (
        <MovementsModal
          key={selected.id}
          product={products.data?.find((p) => p.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            onChanged()
          }}
        />
      )}
    </div>
  )
}

type Action = 'count' | 'damage' | 'return'

function MovementsModal({ product, onClose, onChanged }: { product: Product; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const [action, setAction] = useState<Action>('count')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const moves = useAsync(() => loadMovements(business.id, product.id), [business.id, product.id, product.stockMilli])
  const unit = t(`units.${product.unit ?? 'UNIT'}`)

  const submit = async () => {
    const qty = parseQuantity(amount)
    // Un conteo puede ser 0 (se acabó); una baja o devolución tiene que ser positiva.
    if (qty === null || (action !== 'count' && qty <= 0)) return setInvalid(true)
    setInvalid(false)
    setBusy(true)
    setError(null)
    try {
      const first = (moves.data?.total ?? 0) === 0
      await addMovement(business.id, newId(), {
        productId: product.id,
        kind: action === 'count' ? (first ? 'INITIAL' : 'ADJUSTMENT') : action === 'damage' ? 'DAMAGE' : 'RETURN',
        ...(action === 'count' ? { countedMilli: qty } : { quantityMilli: qty }),
        note: note.trim() || undefined,
      })
      setAmount('')
      setNote('')
      onChanged()
      moves.reload()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={product.name ?? ''} onClose={onClose}>
      <div className="row">
        <strong className={product.stockMilli < 0 ? 'inv-negative' : undefined}>
          {fmt.quantity(product.stockMilli)} {unit}
        </strong>
        {product.stockMilli < 0 && <Tag tone="red">{t('stock.negative')}</Tag>}
      </div>
      {product.stockMilli < 0 && <p className="notice warn">{t('stock.negativeHint')}</p>}
      <div className="chips" role="tablist">
        {(['count', 'damage', 'return'] as Action[]).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={action === a} className={`chip${action === a ? ' on' : ''}`} onClick={() => (setAction(a), setInvalid(false))}>
            {t(`stock.action.${a}`)}
          </button>
        ))}
      </div>
      <p className="muted small">{t(`stock.actionHint.${action}`)}</p>
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="inv-cols">
          <Field label={t(action === 'count' ? 'stock.counted' : 'stock.quantity', { unit })} hint={invalid ? t('problems.quantity') : undefined}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-invalid={invalid} />
          </Field>
          <Field label={t('stock.note')}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </div>
        {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
        <div className="inv-actions">
          <span className="grow" />
          <Button onClick={onClose}>{t('close')}</Button>
          <Button type="submit" kind="primary" disabled={busy}>
            {t('save')}
          </Button>
        </div>
      </form>
      <h3 className="inv-h3">{t('stock.history')}</h3>
      {moves.error ? (
        <ErrorNotice error={moves.error} onRetry={moves.reload} />
      ) : moves.loading && !moves.data ? (
        <Spinner />
      ) : (
        <DataTable
          columns={[
            { key: 'when', header: t('stock.when'), cell: (m) => (m.occurredAt ? fmt.dateTime(m.occurredAt) : '') },
            { key: 'kind', header: t('stock.kind'), cell: (m) => t(`movement.${m.kind ?? 'ADJUSTMENT'}`, { defaultValue: m.kind }) },
            { key: 'qty', header: t('stock.quantityShort'), align: 'right', cell: (m) => <span className={m.quantityMilli < 0 ? 'inv-negative' : m.quantityMilli > 0 ? 'inv-positive' : undefined}>{m.quantityMilli > 0 ? '+' : ''}{fmt.quantity(m.quantityMilli)}</span> },
            { key: 'who', header: t('stock.who'), cell: (m) => [m.createdByName, m.note].filter(Boolean).join(' · ') },
          ]}
          rows={moves.data?.items ?? []}
          rowKey={(m) => m.id}
          empty={t('stock.noMovements')}
        />
      )}
    </Modal>
  )
}
