import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { Modal } from '../../components/Modal'
import { Button, Field } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { errorText } from '../../lib/errors'
import { MIN_REASON, parseQuantity, refundMethods, returnableMilli, returnEstimate, type RefundMethod, type SaleRow } from './types'

/**
 * «Devolver productos» de una venta cobrada: se eligen líneas y cantidades (parcial), el motivo y cómo se devuelve el dinero. La devolución cuenta en la
 * jornada de HOY (no en la de la venta) y vuelve las existencias. El id se genera al abrir: reintentar no la duplica.
 */
export function ReturnDialog({ businessId, sale, onClose, onDone }: { businessId: string; sale: SaleRow | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('ventas')
  const common = useTranslation().t
  const { money, quantity } = useFormat()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState<RefundMethod>('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [returnId, setReturnId] = useState(() => crypto.randomUUID())

  const items = sale?.items ?? []
  const milli = useMemo(() => Object.fromEntries(Object.entries(texts).map(([id, v]) => [id, parseQuantity(v)])), [texts])
  const over = items.some((i) => (milli[i.id] ?? 0) > returnableMilli(i))
  const chosen = items.filter((i) => (milli[i.id] ?? 0) > 0)
  const estimate = sale ? returnEstimate(sale, milli) : 0
  const methods = sale ? refundMethods(sale) : []
  const reasonOk = reason.trim().length >= MIN_REASON

  const close = () => {
    setTexts({})
    setReason('')
    setMethod('CASH')
    setError(null)
    setReturnId(crypto.randomUUID())
    onClose()
  }
  const describe = (e: unknown): string => {
    if (e instanceof ApiError) {
      const known = ['RETURN_EXCEEDS_SOLD', 'CREDIT_NOTE_EXCEEDS', 'NO_CREDIT_TO_REDUCE', 'REASON_REQUIRED', 'RETURN_NOT_ALLOWED', 'SALE_NOT_COMPLETED']
      if (known.includes(e.code)) return t(`return.error.${e.code}`, { min: MIN_REASON })
    }
    return errorText(common, e)
  }
  const submit = async () => {
    if (!sale) return
    setBusy(true)
    setError(null)
    try {
      await call(
        client.PUT('/api/b/{businessId}/sales/{saleId}/returns/{returnId}', {
          params: { path: { businessId, saleId: sale.id, returnId } },
          body: { items: chosen.map((i) => ({ saleItemId: i.id, quantityMilli: milli[i.id] })), reason: reason.trim(), refundMethod: method },
        }),
      )
      close()
      onDone()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={sale !== null} title={t('return.title')} onClose={close}>
      {sale && (
        <div className="return-dialog">
          <p className="muted">{t('return.body')}</p>
          <table className="return-lines">
            <thead>
              <tr>
                <th>{t('detail.product')}</th>
                <th className="right">{t('return.sold')}</th>
                <th className="right">{t('return.left')}</th>
                <th className="right">{t('return.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const left = returnableMilli(i)
                const bad = (milli[i.id] ?? 0) > left
                return (
                  <tr key={i.id}>
                    <td>{[i.name, i.variant].filter(Boolean).join(' · ')}</td>
                    <td className="right">{quantity(i.quantityMilli)}</td>
                    <td className="right">{quantity(left)}</td>
                    <td className="right">
                      <input
                        aria-label={t('return.qtyFor', { name: i.name })}
                        inputMode="decimal"
                        disabled={left === 0}
                        className={bad ? 'invalid' : undefined}
                        value={texts[i.id] ?? ''}
                        placeholder="0"
                        onChange={(e) => setTexts({ ...texts, [i.id]: e.target.value })}
                      />
                      <button type="button" className="link" disabled={left === 0} onClick={() => setTexts({ ...texts, [i.id]: String(left / 1000) })}>
                        {t('return.all')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {over && (
            <p className="notice error" role="alert">
              {t('return.error.RETURN_EXCEEDS_SOLD')}
            </p>
          )}
          <fieldset className="radios">
            <legend>{t('return.method')}</legend>
            {methods.map((m) => (
              <label key={m}>
                <input type="radio" name="refund" checked={method === m} onChange={() => setMethod(m)} /> {t(`return.methods.${m}`)}
              </label>
            ))}
          </fieldset>
          <Field label={common('dialog.reason')} hint={t('return.reasonHint', { min: MIN_REASON })}>
            <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="sale-totals">
            <div className="total">
              <span>{t('return.estimate')}</span>
              <span>{money(estimate)}</span>
            </div>
            <span className="muted small">{t('return.todayNote')}</span>
          </div>
          {error != null && (
            <p className="notice error" role="alert">
              {describe(error)}
            </p>
          )}
          <div className="row">
            <Button onClick={close}>{common('dialog.cancel')}</Button>
            <Button kind="primary" disabled={busy || chosen.length === 0 || over || !reasonOk} onClick={() => void submit()}>
              {t('return.confirm', { amount: money(estimate) })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
