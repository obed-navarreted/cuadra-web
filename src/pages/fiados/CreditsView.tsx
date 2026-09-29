import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Kpi, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { creditSummary, listCredits, PAGE_SIZE, writeOff, type CreditFilter, type CreditView } from './api'
import { LinkDialog, NewCreditDialog, PayDialog, ReasonDialog, StatusTag, type PayTarget } from './dialogs'
import { useDebounced, whatsappUrl } from './lib'

const INITIAL: CreditFilter = { status: 'OPEN', linked: 'ALL', oldOnly: false, q: '', sort: 'OLDEST', page: 0 }

export function CreditsView({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { money, dateTime } = useFormat()
  const [filter, setFilter] = useState<CreditFilter>(INITIAL)
  const debouncedQ = useDebounced(filter.q)
  const summary = useAsync(() => creditSummary(business.id), [business.id])
  const overdueAfter = summary.data?.overdueAfterDays ?? 30
  const list = useAsync(() => listCredits(business.id, { ...filter, q: debouncedQ }, overdueAfter), [business.id, filter.status, filter.linked, filter.oldOnly, filter.sort, filter.page, debouncedQ, overdueAfter])
  const [selected, setSelected] = useState<CreditView | null>(null)
  const [creating, setCreating] = useState(false)

  const set = (patch: Partial<CreditFilter>) => setFilter((f) => ({ ...f, page: 0, ...patch }))
  const refresh = () => {
    list.reload()
    summary.reload()
  }

  const columns: Column<CreditView>[] = [
    {
      key: 'who',
      header: t('credits.col.who'),
      cell: (c) => (
        <div>
          <strong>{c.customerName ?? c.debtorLabel}</strong>
          {!c.customerId && <span className="muted small"> · {t('credits.noCustomer')}</span>}
          {c.note && <div className="muted small">{c.note}</div>}
        </div>
      ),
    },
    { key: 'amount', header: t('credits.col.amount'), align: 'right', cell: (c) => money(c.amountMinor) },
    { key: 'balance', header: t('credits.col.balance'), align: 'right', cell: (c) => <strong>{money(c.balanceMinor)}</strong> },
    { key: 'age', header: t('credits.col.age'), align: 'right', cell: (c) => t('credits.days', { count: c.ageDays }) },
    { key: 'status', header: t('credits.col.status'), cell: (c) => <StatusTag status={c.status ?? 'OPEN'} /> },
  ]

  const s = summary.data
  return (
    <div className="stack">
      {s && (
        <div className="kpis">
          <Kpi label={t('summary.open')} value={money(s.openTotalMinor)} hint={`${t('summary.openCount', { count: s.openCount })} · ${t('summary.customers', { count: s.customersWithDebt })}`} tone="orange" />
          <Kpi label={t('summary.overdue', { days: s.overdueAfterDays })} value={money(s.overdueMinor)} hint={t('summary.overdueCount', { count: s.overdueCount })} />
        </div>
      )}
      <div className="toolbar">
        <div className="chips" role="group" aria-label={t('filters.status')}>
          {(['OPEN', 'PAID', 'ALL'] as const).map((k) => (
            <button key={k} type="button" className={`chip${filter.status === k ? ' on' : ''}`} aria-pressed={filter.status === k} onClick={() => set({ status: k })}>
              {t(`filters.status_${k}`)}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label={t('filters.linked')}>
          {(['ALL', 'WITH', 'WITHOUT'] as const).map((k) => (
            <button key={k} type="button" className={`chip${filter.linked === k ? ' on' : ''}`} aria-pressed={filter.linked === k} onClick={() => set({ linked: k })}>
              {t(`filters.linked_${k}`)}
            </button>
          ))}
          <button type="button" className={`chip${filter.oldOnly ? ' on' : ''}`} aria-pressed={filter.oldOnly} onClick={() => set({ oldOnly: !filter.oldOnly })}>
            {t('filters.old', { days: overdueAfter })}
          </button>
        </div>
        <div className="toolbar-row">
          <Field label={t('filters.search')}>
            <input type="search" value={filter.q} onChange={(e) => set({ q: e.target.value })} />
          </Field>
          <Field label={t('filters.sort')}>
            <select value={filter.sort} onChange={(e) => set({ sort: e.target.value as CreditFilter['sort'] })}>
              {(['OLDEST', 'AMOUNT', 'RECENT'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`filters.sort_${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Button kind="primary" onClick={() => setCreating(true)}>
            {t('newCredit.open')}
          </Button>
        </div>
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Spinner /> : <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(c) => c.id} empty={t('credits.empty')} onRowClick={setSelected} />}
      {list.data && list.data.total > PAGE_SIZE && (
        <div className="pager">
          <Button small disabled={filter.page === 0} onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}>
            {t('pager.prev')}
          </Button>
          <span className="muted small">{t('pager.page', { page: filter.page + 1, pages: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) })}</span>
          <Button small disabled={list.data.last} onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}>
            {t('pager.next')}
          </Button>
        </div>
      )}
      {selected && (
        <CreditDialog
          credit={selected}
          dateTime={dateTime}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            refresh()
          }}
          onOpenCustomer={(id) => {
            setSelected(null)
            onOpenCustomer(id)
          }}
        />
      )}
      {creating && (
        <NewCreditDialog
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function CreditDialog({ credit, dateTime, onClose, onChanged, onOpenCustomer }: { credit: CreditView; dateTime: (i: string) => string; onClose: () => void; onChanged: () => void; onOpenCustomer: (id: string) => void }) {
  const { t } = useTranslation('fiados')
  const { business } = useBusiness()
  const { money } = useFormat()
  const [sub, setSub] = useState<'pay' | 'link' | 'writeOff' | null>(null)
  const open = credit.status === 'OPEN'
  const wa = whatsappUrl(credit.debtorPhone)
  const target: PayTarget = { creditId: credit.id, title: credit.customerName ?? credit.debtorLabel ?? '', balanceMinor: credit.balanceMinor }

  if (sub === 'pay') return <PayDialog target={target} onClose={() => setSub(null)} onDone={onChanged} />
  if (sub === 'link') return <LinkDialog credit={credit} onClose={() => setSub(null)} onDone={onChanged} />
  if (sub === 'writeOff') {
    return (
      <ReasonDialog
        title={t('writeOff.title')}
        hint={t('writeOff.hint', { amount: money(credit.balanceMinor) })}
        confirmLabel={t('writeOff.confirm')}
        required
        danger
        action={(reason) => writeOff(business.id, credit.id, reason)}
        onClose={() => setSub(null)}
        onDone={onChanged}
      />
    )
  }
  return (
    <Modal open title={credit.customerName ?? credit.debtorLabel ?? ''} onClose={onClose}>
      <dl className="facts">
        <dt>{t('credits.col.amount')}</dt>
        <dd>{money(credit.amountMinor)}</dd>
        <dt>{t('credit.paid')}</dt>
        <dd>{money(credit.paidMinor)}</dd>
        <dt>{t('credits.col.balance')}</dt>
        <dd>
          <strong>{money(credit.balanceMinor)}</strong> <StatusTag status={credit.status ?? 'OPEN'} />
        </dd>
        <dt>{t('credit.created')}</dt>
        <dd>{credit.createdAt ? dateTime(credit.createdAt) : '—'}{credit.createdByName ? ` · ${credit.createdByName}` : ''}</dd>
        {credit.dueDate && (
          <>
            <dt>{t('credit.due')}</dt>
            <dd>{credit.dueDate}</dd>
          </>
        )}
        {credit.note && (
          <>
            <dt>{t('credit.note')}</dt>
            <dd>{credit.note}</dd>
          </>
        )}
        {credit.debtorPhone && (
          <>
            <dt>{t('credit.phone')}</dt>
            <dd>{wa ? <a href={wa} target="_blank" rel="noreferrer">{credit.debtorPhone}</a> : credit.debtorPhone}</dd>
          </>
        )}
      </dl>
      <div className="dialog-actions wrap">
        {credit.customerId && <Button onClick={() => onOpenCustomer(credit.customerId as string)}>{t('credit.openCustomer')}</Button>}
        {open && !credit.customerId && <Button onClick={() => setSub('link')}>{t('link.open')}</Button>}
        {open && <Button onClick={() => setSub('writeOff')}>{t('writeOff.open')}</Button>}
        {open && (
          <Button kind="primary" onClick={() => setSub('pay')}>
            {t('pay.open')}
          </Button>
        )}
        <Button onClick={onClose}>{t('close')}</Button>
      </div>
    </Modal>
  )
}

