import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { parseMoney } from '../../lib/money'
import { loadPayments, loadProducts, loadPurchases, loadSuppliers, paySupplier, registerPurchase, voidPayment, voidPurchase } from './api'
import { errorMessage, newId } from './errors'
import { draftTotal, emptyLine, emptyPurchase, toPurchaseInput, type LineDraft, type PurchaseDraft, type PurchaseProblem } from './purchaseDraft'
import { lineTotal, moneyInput, parseQuantity } from './quantity'
import { SOURCES, type PurchaseView } from './types'
import { decimalsOf } from '../../lib/money'

/** Compras a proveedores y lo que se debe. Una compra no se edita: se anula (deshace existencias y pagos) y se registra de nuevo. */
export function PurchasesTab({ supplierId, onSupplier, reloadKey, onChanged }: { supplierId: string; onSupplier: (id: string) => void; reloadKey: number; onChanged: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const [onlyOwed, setOnlyOwed] = useState(false)
  const [includeVoided, setIncludeVoided] = useState(false)
  const [pages, setPages] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const suppliers = useAsync(() => loadSuppliers(business.id), [business.id, reloadKey])
  const list = useAsync(async () => {
    const items: PurchaseView[] = []
    let last = true
    for (let p = 0; p < pages; p++) {
      const r = await loadPurchases(business.id, { supplierId: supplierId || undefined, onlyOwed, includeVoided }, p)
      items.push(...r.items)
      last = r.last
      if (r.last) break
    }
    return { items, last }
  }, [business.id, supplierId, onlyOwed, includeVoided, pages, reloadKey])
  const selected = list.data?.items.find((p) => p.id === selectedId) ?? null
  const owedTotal = (suppliers.data ?? []).reduce((s, x) => s + x.balanceMinor, 0)

  const columns: Column<PurchaseView>[] = [
    { key: 'when', header: t('purchases.col.when'), cell: (p) => (p.occurredAt ? fmt.dateTime(p.occurredAt) : '') },
    { key: 'supplier', header: t('purchases.col.supplier'), cell: (p) => p.supplierName ?? <span className="muted">{t('purchases.noSupplier')}</span> },
    { key: 'total', header: t('purchases.col.total'), align: 'right', cell: (p) => fmt.money(p.totalMinor) },
    { key: 'paid', header: t('purchases.col.paid'), align: 'right', cell: (p) => fmt.money(p.paidMinor) },
    {
      key: 'state',
      header: t('purchases.col.state'),
      cell: (p) => (p.voided ? <Tag tone="red">{t('purchases.voided')}</Tag> : p.balanceMinor > 0 ? <Tag tone="orange">{t('purchases.owes', { amount: fmt.money(p.balanceMinor) })}</Tag> : <Tag tone="green">{t('purchases.paidTag')}</Tag>),
    },
  ]

  return (
    <div className="inv-stack">
      <Card>
        <div className="inv-toolbar">
          <Field label={t('purchases.filterSupplier')}>
            <select value={supplierId} onChange={(e) => (setPages(1), onSupplier(e.target.value))}>
              <option value="">{t('purchases.allSuppliers')}</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="inv-check">
            <input type="checkbox" checked={onlyOwed} onChange={(e) => (setPages(1), setOnlyOwed(e.target.checked))} />
            <span>{t('purchases.onlyOwed')}</span>
          </label>
          <label className="inv-check">
            <input type="checkbox" checked={includeVoided} onChange={(e) => (setPages(1), setIncludeVoided(e.target.checked))} />
            <span>{t('purchases.includeVoided')}</span>
          </label>
          <span className="grow" />
          <Button kind="primary" onClick={() => setCreating(true)}>
            {t('purchases.new')}
          </Button>
        </div>
        <p className="muted small">{t('purchases.owedTotal', { amount: fmt.money(owedTotal) })}</p>
      </Card>
      {list.error ? (
        <ErrorNotice error={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <Spinner />
      ) : (
        <>
          <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(p) => p.id} empty={t('purchases.empty')} onRowClick={(p) => setSelectedId(p.id)} />
          {list.data && !list.data.last && (
            <Button onClick={() => setPages((n) => n + 1)} disabled={list.loading}>
              {t('purchases.more')}
            </Button>
          )}
        </>
      )}
      {selected && (
        <PurchaseModal
          key={selected.id}
          purchase={selected}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            onChanged()
            list.reload()
          }}
        />
      )}
      {creating && (
        <NewPurchaseModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setPages(1)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function PurchaseModal({ purchase, onClose, onChanged }: { purchase: PurchaseView; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const currency = business.currency ?? 'USD'
  const payments = useAsync(() => loadPayments(business.id, purchase.id), [business.id, purchase.id, purchase.paidMinor, purchase.voided])
  const [mode, setMode] = useState<'none' | 'pay' | 'void'>('none')
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null)
  const [amount, setAmount] = useState(() => moneyInput(purchase.balanceMinor, decimalsOf(currency)))
  const [source, setSource] = useState<string>('CASH_DRAWER')
  const [reason, setReason] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const parsed = parseMoney(amount, currency)

  const act = async (fn: () => Promise<unknown>, closeAfter = false) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setMode('none')
      setVoidPaymentId(null)
      setReason('')
      onChanged()
      // Una compra anulada sale de la lista (que no incluye anuladas): el diálogo se cierra a propósito, no porque desaparezca.
      if (closeAfter) onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={purchase.supplierName ?? t('purchases.noSupplier')} onClose={onClose}>
      <div className="row">
        <span className="muted">{purchase.occurredAt ? fmt.dateTime(purchase.occurredAt) : ''}</span>
        {purchase.createdByName && <span className="muted">· {purchase.createdByName}</span>}
        {purchase.voided && <Tag tone="red">{t('purchases.voided')}</Tag>}
      </div>
      {purchase.voided && purchase.voidReason && <p className="muted">{t('purchases.voidReason', { reason: purchase.voidReason })}</p>}
      <DataTable
        columns={[
          { key: 'name', header: t('purchases.line.product'), cell: (l) => l.name },
          { key: 'qty', header: t('purchases.line.quantity'), align: 'right', cell: (l) => fmt.quantity(l.quantityMilli) },
          { key: 'cost', header: t('purchases.line.cost'), align: 'right', cell: (l) => fmt.money(l.unitCostMinor) },
          { key: 'total', header: t('purchases.line.total'), align: 'right', cell: (l) => fmt.money(l.lineTotalMinor) },
        ]}
        rows={purchase.lines ?? []}
        rowKey={(l) => l.id}
        empty=""
      />
      <div className="inv-totals">
        <span>{t('purchases.col.total')}</span>
        <strong>{fmt.money(purchase.totalMinor)}</strong>
        <span>{t('purchases.col.paid')}</span>
        <strong>{fmt.money(purchase.paidMinor)}</strong>
        <span>{t('purchases.balance')}</span>
        <strong className={purchase.balanceMinor > 0 ? 'inv-low' : undefined}>{fmt.money(purchase.balanceMinor)}</strong>
      </div>
      {purchase.note && <p className="muted">{purchase.note}</p>}

      <h3 className="inv-h3">{t('purchases.payments')}</h3>
      {payments.error ? (
        <ErrorNotice error={payments.error} onRetry={payments.reload} />
      ) : payments.loading && !payments.data ? (
        <Spinner />
      ) : (
        <DataTable
          columns={[
            { key: 'when', header: t('purchases.col.when'), cell: (p) => (p.occurredAt ? fmt.dateTime(p.occurredAt) : '') },
            { key: 'source', header: t('purchases.source'), cell: (p) => t(`sources.${p.source ?? 'OTHER'}`) },
            { key: 'amount', header: t('purchases.amount'), align: 'right', cell: (p) => <span className={p.voided ? 'inv-struck' : undefined}>{fmt.money(p.amountMinor)}</span> },
            {
              key: 'act',
              header: '',
              cell: (p) =>
                p.voided ? (
                  <Tag tone="red">{t('purchases.voided')}</Tag>
                ) : purchase.voided ? null : (
                  <Button small onClick={() => (setVoidPaymentId(p.id), setMode('void'), setReason(''))}>
                    {t('purchases.voidPayment')}
                  </Button>
                ),
            },
          ]}
          rows={payments.data ?? []}
          rowKey={(p) => p.id}
          empty={t('purchases.noPayments')}
        />
      )}

      {mode === 'pay' && (
        <form
          className="inv-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed === null || parsed <= 0) return setInvalid(true)
            setInvalid(false)
            void act(() => paySupplier(business.id, newId(), { purchaseId: purchase.id, amountMinor: parsed, source }))
          }}
        >
          <div className="inv-cols">
            <Field label={t('purchases.amount')} hint={invalid ? t('problems.amount') : parsed !== null && parsed > purchase.balanceMinor ? t('purchases.payTooMuch') : undefined}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-invalid={invalid} />
            </Field>
            <Field label={t('purchases.source')} hint={t(`sourceHint.${source === 'CASH_DRAWER' ? 'drawer' : 'other'}`)}>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sources.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="inv-actions">
            <span className="grow" />
            <Button onClick={() => setMode('none')}>{t('cancel')}</Button>
            <Button type="submit" kind="primary" disabled={busy}>
              {t('purchases.pay')}
            </Button>
          </div>
        </form>
      )}
      {mode === 'void' && (
        <form
          className="inv-form"
          onSubmit={(e) => {
            e.preventDefault()
            void act(() => (voidPaymentId ? voidPayment(business.id, voidPaymentId, reason.trim()) : voidPurchase(business.id, purchase.id, reason.trim())), voidPaymentId === null)
          }}
        >
          <p className="notice warn">{t(voidPaymentId ? 'purchases.voidPaymentHint' : 'purchases.voidHint')}</p>
          <Field label={t('purchases.reason')}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </Field>
          <div className="inv-actions">
            <span className="grow" />
            <Button onClick={() => (setMode('none'), setVoidPaymentId(null))}>{t('cancel')}</Button>
            <Button type="submit" kind="danger" disabled={busy}>
              {t(voidPaymentId ? 'purchases.voidPayment' : 'purchases.void')}
            </Button>
          </div>
        </form>
      )}
      {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
      {mode === 'none' && (
        <div className="inv-actions">
          {!purchase.voided && (
            <Button onClick={() => (setMode('void'), setVoidPaymentId(null), setReason(''))}>{t('purchases.void')}</Button>
          )}
          <span className="grow" />
          <Button onClick={onClose}>{t('close')}</Button>
          {!purchase.voided && purchase.balanceMinor > 0 && (
            <Button kind="primary" onClick={() => setMode('pay')}>
              {t('purchases.pay')}
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}

function NewPurchaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('inventario')
  const { business } = useBusiness()
  const fmt = useFormat()
  const currency = business.currency ?? 'USD'
  const products = useAsync(() => loadProducts(business.id), [business.id])
  const suppliers = useAsync(() => loadSuppliers(business.id), [business.id])
  const [draft, setDraft] = useState<PurchaseDraft>(() => emptyPurchase(newId()))
  const [problems, setProblems] = useState<PurchaseProblem[]>([])
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data])
  const total = draftTotal(draft, currency)
  const paidNow = draft.paid === null ? total : parseMoney(draft.paid.trim() === '' ? '0' : draft.paid, currency)
  const remaining = paidNow === null ? null : Math.max(0, total - paidNow)

  const setLine = (key: string, patch: Partial<LineDraft>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const pickProduct = (key: string, productId: string) => {
    const p = byId.get(productId)
    setLine(key, { productId, name: '', cost: p?.costMinor != null ? moneyInput(p.costMinor, decimalsOf(currency)) : '' })
  }

  const save = async () => {
    const { input, problems: found } = toPurchaseInput(draft, currency, () => newId())
    setProblems(found)
    if (!input) return
    setSaving(true)
    setError(null)
    try {
      await registerPurchase(business.id, newId(), input)
      onSaved()
    } catch (e) {
      setError(e)
      setSaving(false)
    }
  }

  return (
    <Modal open title={t('purchases.newTitle')} onClose={onClose}>
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="inv-cols">
          <Field label={t('purchases.supplier')}>
            <select value={draft.supplierId} onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })}>
              <option value="">{t('purchases.noSupplierOption')}</option>
              {(suppliers.data ?? []).filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {!draft.supplierId && (
            <Field label={t('purchases.supplierName')} hint={t('purchases.supplierNameHint')}>
              <input value={draft.supplierName} onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })} maxLength={120} />
            </Field>
          )}
        </div>
        <h3 className="inv-h3">{t('purchases.lines')}</h3>
        {draft.lines.map((l) => {
          const q = parseQuantity(l.quantity)
          const c = parseMoney(l.cost, currency)
          const bad = problems.includes(`line:${l.key}`)
          return (
            <div key={l.key} className={`inv-line${bad ? ' bad' : ''}`}>
              <Field label={t('purchases.line.product')}>
                <select value={l.productId} onChange={(e) => pickProduct(l.key, e.target.value)}>
                  <option value="">{t('purchases.freeText')}</option>
                  {(products.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.variant ? ` · ${p.variant}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {!l.productId && (
                <Field label={t('purchases.line.name')}>
                  <input value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} aria-invalid={bad} />
                </Field>
              )}
              <div className="inv-cols">
                <Field label={t('purchases.line.quantity')}>
                  <input value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} inputMode="decimal" aria-invalid={bad} />
                </Field>
                <Field label={t('purchases.line.cost')}>
                  <input value={l.cost} onChange={(e) => setLine(l.key, { cost: e.target.value })} inputMode="decimal" aria-invalid={bad} />
                </Field>
              </div>
              <div className="inv-line-foot">
                <strong>{q !== null && q > 0 && c !== null ? fmt.money(lineTotal(c, q)) : '—'}</strong>
                <span className="grow" />
                {draft.lines.length > 1 && (
                  <Button small onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) }))}>
                    {t('purchases.removeLine')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {problems.includes('lines') && <div className="notice error" role="alert">{t('problems.lines')}</div>}
        {problems.some((p) => p.startsWith('line:')) && <div className="notice error" role="alert">{t('problems.line')}</div>}
        <Button onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine(newId())] }))}>{t('purchases.addLine')}</Button>

        <div className="inv-totals">
          <span>{t('purchases.col.total')}</span>
          <strong>{fmt.money(total)}</strong>
        </div>
        <div className="inv-cols">
          <Field label={t('purchases.paidNow')} hint={problems.includes('paid') ? t('problems.paid') : undefined}>
            <input
              value={draft.paid === null ? moneyInput(total, decimalsOf(currency)) : draft.paid}
              onChange={(e) => setDraft({ ...draft, paid: e.target.value })}
              inputMode="decimal"
              aria-invalid={problems.includes('paid')}
            />
          </Field>
          <Field label={t('purchases.source')} hint={t(`sourceHint.${draft.paidSource === 'CASH_DRAWER' ? 'drawer' : 'other'}`)}>
            <select value={draft.paidSource} onChange={(e) => setDraft({ ...draft, paidSource: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`sources.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {remaining !== null && remaining > 0 && <p className="notice warn">{t('purchases.remaining', { amount: fmt.money(remaining) })}</p>}
        <Field label={t('purchases.note')}>
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={300} />
        </Field>
        {error !== null && <div className="notice error" role="alert">{errorMessage(t, error)}</div>}
        <div className="inv-actions">
          <span className="grow" />
          <Button onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button type="submit" kind="primary" disabled={saving}>
            {t('purchases.save', { amount: fmt.money(total) })}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
