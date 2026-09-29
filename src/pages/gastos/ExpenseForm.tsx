import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { categoryLabel, checkDraft, occurredAtFor, type ExpenseDraft } from './logic'
import { SOURCES, type ExpenseCategory } from './types'

/** Registrar un gasto desde la web (por ejemplo, el pago de un servicio por transferencia). Los gastos no se editan: se anulan y se vuelve a registrar. */
export function ExpenseForm({ open, categories, onClose, onSaved }: { open: boolean; categories: ExpenseCategory[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('gastos')
  const { business } = useBusiness()
  const { today, timezone, currency } = useFormat()
  const blank = (): ExpenseDraft => ({ amount: '', description: '', categoryId: '', source: 'BANK', date: today() })
  const [draft, setDraft] = useState<ExpenseDraft>(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [invalid, setInvalid] = useState<'amount' | 'date' | 'description' | null>(null)

  const set = <K extends keyof ExpenseDraft>(k: K, v: ExpenseDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setInvalid(null)
  }
  const close = () => {
    setDraft(blank())
    setError(null)
    setInvalid(null)
    onClose()
  }
  const save = async () => {
    const check = checkDraft(draft, currency, today())
    if (!check.ok) return setInvalid(check.error)
    setBusy(true)
    setError(null)
    try {
      await call(
        client.PUT('/api/b/{businessId}/expenses/{expenseId}', {
          params: { path: { businessId: business.id, expenseId: crypto.randomUUID() } },
          body: { amountMinor: check.amountMinor, source: draft.source, categoryId: draft.categoryId || undefined, description: draft.description.trim() || undefined, occurredAt: occurredAtFor(draft.date, today(), timezone) },
        }),
      )
      setDraft(blank())
      onSaved()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={t('form.title')} onClose={close}>
      <div className="form-grid">
        <Field label={t('form.amount')} hint={invalid === 'amount' ? t('form.invalidAmount') : undefined}>
          <input inputMode="decimal" value={draft.amount} aria-invalid={invalid === 'amount'} onChange={(e) => set('amount', e.target.value)} autoFocus />
        </Field>
        <Field label={t('form.description')}>
          <input value={draft.description} maxLength={200} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label={t('form.category')}>
          <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">{t('form.noCategory')}</option>
            {categories.filter((c) => c.active).map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, (k) => t(`cat.${k}`, { defaultValue: '' }) || null)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('form.source')} hint={t(draft.source === 'CASH_DRAWER' ? 'form.sourceCashHint' : 'form.sourceOtherHint')}>
          <select value={draft.source} onChange={(e) => set('source', e.target.value as ExpenseDraft['source'])}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`source.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('form.date')} hint={invalid === 'date' ? t('form.invalidDate') : undefined}>
          <input type="date" value={draft.date} max={today()} aria-invalid={invalid === 'date'} onChange={(e) => set('date', e.target.value)} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="row">
          <Button onClick={close}>{t('form.cancel')}</Button>
          <Button kind="primary" disabled={busy} onClick={() => void save()}>
            {t('form.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
