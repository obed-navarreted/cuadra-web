import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { decimalsOf, parseMoney } from '../../lib/money'
import { createCredit, linkCustomer, listCustomers, pay, saveCustomer, type CreditView, type CustomerView } from './api'
import { PAY_METHODS, useDebounced, type PayMethod } from './lib'

/** Qué se cobra: un fiado concreto, o al cliente (el servidor reparte del más viejo al más nuevo). */
export type PayTarget = { creditId?: string; customerId?: string; title: string; balanceMinor: number }

export function PayDialog({ target, onClose, onDone }: { target: PayTarget; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { money, currency } = useFormat()
  // El id del abono nace al abrir el diálogo: si se envía dos veces, el servidor lo reconoce y no cobra otra vez.
  const paymentId = useMemo(() => crypto.randomUUID(), [])
  const [amount, setAmount] = useState(() => (target.balanceMinor / 10 ** decimalsOf(currency)).toString())
  const [method, setMethod] = useState<PayMethod>('TRANSFER')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const minor = parseMoney(amount, currency)
  const over = minor !== null && minor > target.balanceMinor

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (minor === null || minor <= 0) return
    setBusy(true)
    setError(null)
    try {
      await pay(business.id, paymentId, { creditId: target.creditId, customerId: target.customerId, amountMinor: minor, method, reference: reference.trim() || undefined })
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={t('pay.title')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <p>
          <strong>{target.title}</strong> · {t('pay.owes', { amount: money(target.balanceMinor) })}
        </p>
        {!target.creditId && <p className="muted small">{t('pay.fifo')}</p>}
        <Field label={t('pay.amount')}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={minor === null || minor <= 0} required />
        </Field>
        {over && <p className="notice warn">{t('pay.over', { amount: money(minor - target.balanceMinor) })}</p>}
        <Field label={t('pay.method')}>
          <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`method.${m}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('pay.reference')} hint={t('pay.referenceHint')}>
          <input value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || minor === null || minor <= 0}>
            {minor !== null && minor > 0 ? t('pay.confirm', { amount: money(minor) }) : t('pay.confirmEmpty')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Pide un motivo (obligatorio para condonar; opcional para anular un abono) y ejecuta la acción. */
export function ReasonDialog({ title, hint, confirmLabel, required, danger, action, onClose, onDone }: {
  title: string
  hint?: string
  confirmLabel: string
  required?: boolean
  danger?: boolean
  action: (reason: string) => Promise<unknown>
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation('fiados')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action(reason.trim())
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
  return (
    <Modal open title={title} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        {hint && <p className="muted">{hint}</p>}
        <Field label={required ? t('reason.required') : t('reason.optional')}>
          <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} required={required} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind={danger ? 'danger' : 'primary'} disabled={busy || (required === true && !reason.trim())}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Vincula un fiado "de nota" a un cliente que ya existe, o crea el cliente en el momento. */
export function LinkDialog({ credit, onClose, onDone }: { credit: CreditView; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const [q, setQ] = useState(credit.debtorLabel ?? '')
  const search = useDebounced(q)
  const found = useAsync(() => listCustomers(business.id, search, false, false, 0), [business.id, search])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function link(customerId: string) {
    setBusy(true)
    setError(null)
    try {
      await linkCustomer(business.id, credit.id, customerId)
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  async function createAndLink() {
    const name = (credit.debtorLabel ?? q).trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const id = crypto.randomUUID()
      await saveCustomer(business.id, id, { name, phone: credit.debtorPhone ?? undefined })
      await linkCustomer(business.id, credit.id, id)
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const items = found.data?.items ?? []
  return (
    <Modal open title={t('link.title')} onClose={onClose}>
      <div className="dialog-form">
        <p className="muted">{t('link.hint', { name: credit.debtorLabel })}</p>
        <Field label={t('link.search')}>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        {found.error && <ErrorNotice error={found.error} onRetry={found.reload} />}
        <ul className="pick-list">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" className="pick" disabled={busy} onClick={() => void link(c.id)}>
                <span className="grow">{c.name}</span>
                {c.phone && <span className="muted small">{c.phone}</span>}
              </button>
            </li>
          ))}
          {!found.loading && items.length === 0 && <li className="muted small">{t('link.none')}</li>}
        </ul>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button kind="primary" disabled={busy} onClick={() => void createAndLink()}>
            {t('link.createNew', { name: (credit.debtorLabel ?? q).trim() })}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Un fiado que no viene de una venta (el cuaderno de siempre): a un cliente o solo con un nombre. */
export function NewCreditDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { currency } = useFormat()
  const creditId = useMemo(() => crypto.randomUUID(), [])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const minor = parseMoney(amount, currency)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (minor === null || minor <= 0 || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createCredit(business.id, creditId, { debtorLabel: name.trim(), debtorPhone: phone.trim() || undefined, amountMinor: minor, note: note.trim() || undefined, dueDate: due || undefined })
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={t('newCredit.title')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <p className="muted">{t('newCredit.hint')}</p>
        <Field label={t('newCredit.name')}>
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('newCredit.phone')}>
          <input inputMode="tel" value={phone} maxLength={24} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('newCredit.amount')}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={amount !== '' && minor === null} required />
        </Field>
        <Field label={t('newCredit.note')}>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label={t('newCredit.due')}>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || minor === null || minor <= 0 || !name.trim()}>
            {t('newCredit.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function StatusTag({ status }: { status: string }) {
  const { t } = useTranslation('fiados')
  const tone = status === 'PAID' ? 'green' : status === 'OPEN' ? 'orange' : 'neutral'
  return <Tag tone={tone}>{t(`status.${status}`, { defaultValue: status })}</Tag>
}

export type { CustomerView }
