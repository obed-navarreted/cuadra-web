import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Pager } from '../../components/Pager'
import { ReasonDialog } from '../../components/ReasonDialog'
import { Button, Card, ErrorNotice, Field, Kpi, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { ExpenseForm } from './ExpenseForm'
import { bars, categoryLabel, splitVoided } from './logic'
import { SOURCES, type Expense, type ExpenseCategory } from './types'

const PAGE_SIZE = 50

export function ExpensesTab({ range, categories }: { range: DateRange; categories: ExpenseCategory[] }) {
  const { t } = useTranslation('gastos')
  const { business } = useBusiness()
  const businessId = business.id
  const { money, dateTime } = useFormat()
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [toVoid, setToVoid] = useState<Expense | null>(null)
  const label = (c: { key?: string | null; name?: string | null }) => categoryLabel(c, (k) => t(`cat.${k}`, { defaultValue: '' }) || null)

  const summary = useAsync(
    async () => (await call(client.GET('/api/b/{businessId}/expenses/summary', { params: { path: { businessId }, query: { from: range.from, to: range.to } } }))),
    [businessId, range.from, range.to],
  )
  // Se piden también los anulados y se separan aquí: así siguen a la vista, pero aparte y sin sumar.
  const list = useAsync(
    () =>
      call(
        client.GET('/api/b/{businessId}/expenses', {
          params: { path: { businessId }, query: { from: range.from, to: range.to, source: source || undefined, categoryId: category || undefined, includeVoided: true, page, size: PAGE_SIZE } },
        }),
      ),
    [businessId, range.from, range.to, source, category, page],
  )
  const { active, voided } = useMemo(() => splitVoided(list.data?.items ?? []), [list.data])

  const columns: Column<Expense>[] = [
    { key: 'date', header: t('col.date'), className: 'nowrap', cell: (e) => dateTime(e.occurredAt ?? '') },
    { key: 'what', header: t('col.what'), cell: (e) => e.description ?? <span className="muted">—</span> },
    { key: 'cat', header: t('col.category'), cell: (e) => (e.categoryKey || e.categoryName ? label({ key: e.categoryKey, name: e.categoryName }) : <span className="muted">—</span>) },
    { key: 'source', header: t('col.source'), cell: (e) => <Tag tone={e.source === 'CASH_DRAWER' ? 'orange' : 'neutral'}>{t(`source.${e.source ?? 'OTHER'}`, { defaultValue: e.source ?? '' })}</Tag> },
    { key: 'by', header: t('col.by'), cell: (e) => e.createdByName ?? '—' },
    { key: 'amount', header: t('col.amount'), align: 'right', cell: (e) => <strong>{money(e.amountMinor)}</strong> },
    { key: 'act', header: t('col.actions'), cell: (e) => (e.voided ? <Tag tone="red">{t('voided')}</Tag> : <Button small onClick={() => setToVoid(e)}>{t('void.action')}</Button>) },
  ]
  const voidedColumns: Column<Expense>[] = [
    ...columns.slice(0, 6),
    { key: 'why', header: t('col.reason'), cell: (e) => e.voidReason ?? <span className="muted">—</span> },
  ]
  const s = summary.data
  const reset = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(0)
  }

  return (
    <>
      <div className="gastos-filters">
        <div className="selects">
          <Field label={t('filter.source')}>
            <select value={source} onChange={(e) => reset(setSource)(e.target.value)}>
              <option value="">{t('filter.all')}</option>
              {SOURCES.map((x) => (
                <option key={x} value={x}>
                  {t(`source.${x}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('filter.category')}>
            <select value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
              <option value="">{t('filter.all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c)}
                </option>
              ))}
            </select>
          </Field>
          <Button kind="primary" onClick={() => setCreating(true)}>
            {t('new')}
          </Button>
        </div>
      </div>

      {summary.error && <ErrorNotice error={summary.error} onRetry={summary.reload} />}
      {s && (
        <div className="kpis compact">
          <Kpi label={t('kpi.total')} value={money(s.cashDrawerMinor + s.otherMinor)} hint={t('kpi.count', { count: s.count })} />
          <Kpi label={t('kpi.drawer')} value={money(s.cashDrawerMinor)} tone="orange" hint={t('kpi.drawerHint')} />
          <Kpi label={t('kpi.other')} value={money(s.otherMinor)} hint={t('kpi.otherHint')} />
        </div>
      )}
      {s && (s.byCategory?.length ?? 0) > 0 && (
        <Card title={t('byCategory')}>
          <div className="cat-bars">
            {bars(s.byCategory ?? []).map(({ row, percent }) => (
              <div className="cat-bar" key={row.categoryId ?? 'none'}>
                <span>{row.key || row.name ? label(row) : t('uncategorized')}</span>
                <span className="track" aria-hidden="true">
                  <span className="fill" style={{ width: `${percent}%` }} />
                </span>
                <strong>{money(row.amountMinor)}</strong>
              </div>
            ))}
          </div>
        </Card>
      )}

      {list.error ? (
        <ErrorNotice error={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <Spinner />
      ) : (
        <>
          <DataTable columns={columns} rows={active} rowKey={(e) => e.id ?? ''} empty={t('empty')} />
          <Pager page={page} size={PAGE_SIZE} total={list.data?.total ?? 0} onChange={setPage} />
          {voided.length > 0 && (
            <>
              <h2>{t('voidedTitle', { count: voided.length })}</h2>
              <DataTable columns={voidedColumns} rows={voided} rowKey={(e) => e.id ?? ''} empty="" />
            </>
          )}
        </>
      )}

      <ExpenseForm open={creating} categories={categories} onClose={() => setCreating(false)} onSaved={() => (list.reload(), summary.reload())} />
      <ReasonDialog
        open={toVoid !== null}
        title={t('void.title')}
        body={t('void.body', { amount: toVoid ? money(toVoid.amountMinor) : '' })}
        confirmLabel={t('void.confirm')}
        onClose={() => setToVoid(null)}
        // Un gasto que nació de un pago a proveedor no se anula suelto: se anula el pago desde Compras.
        describe={(e) => (e instanceof ApiError && e.code === 'EXPENSE_LINKED' ? t('void.linked') : null)}
        onConfirm={async (reason) => {
          if (!toVoid?.id) return
          await call(client.POST('/api/b/{businessId}/expenses/{expenseId}/void', { params: { path: { businessId, expenseId: toVoid.id } }, body: { reason: reason || undefined } }))
          list.reload()
          summary.reload()
        }}
      />
    </>
  )
}
