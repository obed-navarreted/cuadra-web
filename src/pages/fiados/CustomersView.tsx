import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { decimalsOf, parseMoney } from '../../lib/money'
import { listCustomers, PAGE_SIZE, saveCustomer, statement, voidPayment, type CustomerView, type Movement } from './api'
import { PayDialog, ReasonDialog } from './dialogs'
import { ageInDays, useDebounced, whatsappUrl } from './lib'

export function CustomersView({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { money, today } = useFormat()
  const [q, setQ] = useState('')
  const [debtOnly, setDebtOnly] = useState(false)
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const search = useDebounced(q)
  const list = useAsync(() => listCustomers(business.id, search, debtOnly, archived, page), [business.id, search, debtOnly, archived, page])
  const [creating, setCreating] = useState(false)
  const tz = business.timezone ?? 'UTC'
  const cutoff = business.dayCutoff?.slice(0, 5) ?? '02:00'

  const columns: Column<CustomerView>[] = [
    {
      key: 'name',
      header: t('customers.col.name'),
      cell: (c) => (
        <div>
          <strong>{c.name}</strong> {c.archived && <Tag>{t('customers.archived')}</Tag>}
        </div>
      ),
    },
    { key: 'phone', header: t('customers.col.phone'), cell: (c) => c.phone ?? '—' },
    { key: 'balance', header: t('customers.col.balance'), align: 'right', cell: (c) => (c.balanceMinor > 0 ? <strong className="owes">{money(c.balanceMinor)}</strong> : money(0)) },
    { key: 'oldest', header: t('customers.col.oldest'), align: 'right', cell: (c) => (c.oldestOpenAt && c.balanceMinor > 0 ? t('credits.days', { count: ageInDays(c.oldestOpenAt, today(), tz, cutoff) }) : '—') },
  ]

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="toolbar-row">
          <Field label={t('filters.search')}>
            <input type="search" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={debtOnly} onChange={(e) => (setDebtOnly(e.target.checked), setPage(0))} /> {t('customers.debtOnly')}
          </label>
          <label className="check">
            <input type="checkbox" checked={archived} onChange={(e) => (setArchived(e.target.checked), setPage(0))} /> {t('customers.showArchived')}
          </label>
          <Button kind="primary" onClick={() => setCreating(true)}>
            {t('customers.new')}
          </Button>
        </div>
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Spinner /> : <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(c) => c.id} empty={t('customers.empty')} onRowClick={(c) => onOpen(c.id)} />}
      {list.data && list.data.total > PAGE_SIZE && (
        <div className="pager">
          <Button small disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t('pager.prev')}
          </Button>
          <span className="muted small">{t('pager.page', { page: page + 1, pages: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) })}</span>
          <Button small disabled={list.data.last} onClick={() => setPage(page + 1)}>
            {t('pager.next')}
          </Button>
        </div>
      )}
      {creating && (
        <CustomerForm
          customer={null}
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false)
            list.reload()
            onOpen(c.id)
          }}
        />
      )}
    </div>
  )
}

/** Crear o editar un cliente. El id de uno nuevo lo genera la pantalla (así reenviar no crea dos). */
export function CustomerForm({ customer, onClose, onSaved }: { customer: CustomerView | null; onClose: () => void; onSaved: (c: CustomerView) => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { currency } = useFormat()
  const [id] = useState(() => customer?.id ?? crypto.randomUUID())
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')
  const [limit, setLimit] = useState(customer?.creditLimitMinor != null ? (customer.creditLimitMinor / 10 ** decimalsOf(currency)).toString() : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const limitMinor = limit.trim() === '' ? undefined : parseMoney(limit, currency)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || limitMinor === null) return
    setBusy(true)
    setError(null)
    try {
      onSaved(await saveCustomer(business.id, id, { name: name.trim(), phone: phone.trim() || undefined, notes: notes.trim() || undefined, creditLimitMinor: limitMinor, archived: customer?.archived ?? false }))
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={customer ? t('customer.edit') : t('customers.new')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <Field label={t('customer.name')}>
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('customer.phone')}>
          <input inputMode="tel" value={phone} maxLength={24} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label={t('customer.limit')} hint={t('customer.limitHint')}>
          <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} aria-invalid={limitMinor === null} />
        </Field>
        <Field label={t('customer.notes')}>
          <textarea value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !name.trim() || limitMinor === null}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Ficha del cliente: su estado de cuenta en orden, con acciones (abonar, anular un abono, editar, archivar). */
export function CustomerDialog({ customerId, onClose, onChanged }: { customerId: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { money, dateTime } = useFormat()
  const data = useAsync(() => statement(business.id, customerId), [business.id, customerId])
  const [sub, setSub] = useState<'pay' | 'edit' | { void: Movement } | 'archive' | null>(null)
  const c = data.data?.customer
  const wa = whatsappUrl(c?.phone)

  const done = () => {
    setSub(null)
    data.reload()
    onChanged()
  }

  if (sub === 'pay' && c) return <PayDialog target={{ customerId: c.id, title: c.name ?? '', balanceMinor: c.balanceMinor }} onClose={() => setSub(null)} onDone={done} />
  if (sub === 'edit' && c) return <CustomerForm customer={c} onClose={() => setSub(null)} onSaved={done} />
  if (sub === 'archive' && c) {
    return (
      <ReasonDialog
        title={c.archived ? t('customer.unarchiveTitle') : t('customer.archiveTitle')}
        hint={c.archived ? t('customer.unarchiveHint') : t('customer.archiveHint')}
        confirmLabel={c.archived ? t('customer.unarchive') : t('customer.archive')}
        action={() => saveCustomer(business.id, c.id, { name: c.name ?? '', phone: c.phone ?? undefined, notes: c.notes ?? undefined, creditLimitMinor: c.creditLimitMinor ?? undefined, archived: !c.archived })}
        onClose={() => setSub(null)}
        onDone={done}
      />
    )
  }
  if (typeof sub === 'object' && sub && 'void' in sub) {
    const m = sub.void
    return (
      <ReasonDialog
        title={t('void.title')}
        hint={t('void.hint', { amount: money(m.amountMinor) })}
        confirmLabel={t('void.confirm')}
        danger
        action={(reason) => voidPayment(business.id, m.paymentId as string, reason)}
        onClose={() => setSub(null)}
        onDone={done}
      />
    )
  }

  const columns: Column<Movement>[] = [
    { key: 'at', header: t('statement.col.date'), cell: (m) => (m.at ? dateTime(m.at) : '—') },
    {
      key: 'what',
      header: t('statement.col.what'),
      cell: (m) => (
        <div>
          <strong>{t(`statement.kind_${m.kind}`, { defaultValue: m.kind })}</strong> {m.voided && <Tag tone="red">{t('statement.voided')}</Tag>}
          {m.label && <div className="muted small">{m.kind === 'PAYMENT' ? t(`method.${m.label}`, { defaultValue: m.label }) : m.label}</div>}
        </div>
      ),
    },
    { key: 'amount', header: t('statement.col.amount'), align: 'right', cell: (m) => <span className={m.kind === 'PAYMENT' ? 'pays' : 'owes'}>{m.kind === 'PAYMENT' ? '−' : ''}{money(m.amountMinor)}</span> },
    { key: 'by', header: t('statement.col.by'), cell: (m) => m.memberName ?? '—' },
    {
      key: 'act',
      header: '',
      cell: (m) =>
        m.kind === 'PAYMENT' && !m.voided && m.paymentId ? (
          <Button small onClick={() => setSub({ void: m })}>
            {t('void.open')}
          </Button>
        ) : null,
    },
  ]

  return (
    <Modal open title={c?.name ?? t('customer.loading')} onClose={onClose}>
      {data.error && <ErrorNotice error={data.error} onRetry={data.reload} />}
      {!c && !data.error && <Spinner />}
      {c && (
        <>
          <div className="customer-head">
            <div>
              <div className="muted small">{t('customers.col.balance')}</div>
              <div className={c.balanceMinor > 0 ? 'big owes' : 'big'}>{money(c.balanceMinor)}</div>
            </div>
            <div className="grow">
              {c.phone && <div>{wa ? <a href={wa} target="_blank" rel="noreferrer">{c.phone}</a> : c.phone}</div>}
              {c.creditLimitMinor != null && <div className="muted small">{t('customer.limitValue', { amount: money(c.creditLimitMinor) })}</div>}
              {c.notes && <div className="muted small">{c.notes}</div>}
              {c.archived && <Tag>{t('customers.archived')}</Tag>}
            </div>
          </div>
          <div className="dialog-actions wrap start">
            {c.balanceMinor > 0 && (
              <Button kind="primary" onClick={() => setSub('pay')}>
                {t('pay.openCustomer')}
              </Button>
            )}
            <Button onClick={() => setSub('edit')}>{t('customer.edit')}</Button>
            <Button onClick={() => setSub('archive')}>{c.archived ? t('customer.unarchive') : t('customer.archive')}</Button>
          </div>
          <DataTable columns={columns} rows={data.data?.movements ?? []} rowKey={(m) => `${m.kind}-${m.paymentId ?? m.creditId}-${m.at}`} empty={t('statement.empty')} />
          <div className="dialog-actions">
            <Button onClick={onClose}>{t('close')}</Button>
          </div>
        </>
      )}
    </Modal>
  )
}
