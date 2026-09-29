import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client, downloadFile } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Pager } from '../../components/Pager'
import { RangePicker } from '../../components/RangePicker'
import { ReasonDialog } from '../../components/ReasonDialog'
import { Button, Card, ErrorNotice, Field, Kpi, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { usePlan } from '../../plan/context'
import { canExport } from '../../plan/logic'
import { ProTag } from '../../plan/ProTag'
import type { DateRange } from '../../lib/dates'
import { SaleDetail } from './SaleDetail'
import { distinctMethods, METHODS, saleInstant, type SaleRow } from './types'
import './ventas.css'

const PAGE_SIZE = 25

export default function VentasPage() {
  const { t, i18n } = useTranslation('ventas')
  const { business } = useBusiness()
  const businessId = business.id
  const { money, dateTime, today } = useFormat()
  const [range, setRange] = useState<DateRange>(() => ({ from: today(), to: today() }))
  const [status, setStatus] = useState<'COMPLETED' | 'CANCELLED'>('COMPLETED')
  const [method, setMethod] = useState('')
  const [member, setMember] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<SaleRow | null>(null)
  const [toCancel, setToCancel] = useState<SaleRow | null>(null)
  const [exportError, setExportError] = useState<unknown>(null)

  const members = useAsync(() => call(client.GET('/api/b/{businessId}/members', { params: { path: { businessId } } })), [businessId])
  const list = useAsync(
    () =>
      call(
        client.GET('/api/b/{businessId}/sales', {
          params: { path: { businessId }, query: { status, from: range.from, to: range.to, byMember: member || undefined, method: method || undefined, page, size: PAGE_SIZE } },
        }),
      ),
    [businessId, status, range.from, range.to, member, method, page],
  )
  // Los totales del periodo salen del reporte (ventas cobradas de esas jornadas), no de sumar la página que se ve.
  const report = useAsync(
    async () => (await call(client.GET('/api/b/{businessId}/reports/sales', { params: { path: { businessId }, query: { from: range.from, to: range.to } } }))),
    [businessId, range.from, range.to],
  )

  const rows = list.data?.items ?? []
  const columns = useMemo<Column<SaleRow>[]>(
    () => [
      { key: 'date', header: t('col.date'), className: 'nowrap', cell: (s) => (saleInstant(s) ? dateTime(saleInstant(s) as string) : '—') },
      { key: 'by', header: t('col.by'), cell: (s) => s.completedBy?.name ?? s.createdBy?.name ?? '—' },
      {
        key: 'methods',
        header: t('col.payments'),
        cell: (s) => (
          <span className="ventas-methods">
            {distinctMethods(s.payments).map((m) => (
              <Tag key={m} tone={m === 'CREDIT' ? 'orange' : 'neutral'}>
                {t(`method.${m}`, { defaultValue: m })}
              </Tag>
            ))}
          </span>
        ),
      },
      { key: 'state', header: t('col.status'), cell: (s) => (s.status === 'CANCELLED' ? <Tag tone="red">{t('status.CANCELLED')}</Tag> : <Tag tone="green">{t('status.COMPLETED')}</Tag>) },
      { key: 'total', header: t('col.total'), align: 'right', cell: (s) => <strong>{money(s.totalMinor)}</strong> },
    ],
    [t, money, dateTime],
  )

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }
  const download = async (kind: 'sales' | 'sale-items') => {
    setExportError(null)
    try {
      await downloadFile(`/api/b/${businessId}/reports/${kind}.csv`, { from: range.from, to: range.to, lang: i18n.language })
    } catch (e) {
      setExportError(e)
    }
  }
  const s = report.data?.sales
  const exportOk = canExport(usePlan().plan)

  return (
    <Page
      title={t('title')}
      actions={
        <>
          <Button small disabled={!exportOk} onClick={() => void download('sales')}>
            {t('export.sales')}
            {!exportOk && <ProTag />}
          </Button>
          <Button small disabled={!exportOk} onClick={() => void download('sale-items')}>
            {t('export.items')}
            {!exportOk && <ProTag />}
          </Button>
        </>
      }
    >
      <div className="ventas-filters">
        <RangePicker value={range} onChange={reset(setRange)} />
        <div className="selects">
          <Field label={t('filter.status')}>
            <select value={status} onChange={(e) => reset(setStatus)(e.target.value as 'COMPLETED' | 'CANCELLED')}>
              <option value="COMPLETED">{t('status.COMPLETED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
            </select>
          </Field>
          <Field label={t('filter.method')}>
            <select value={method} onChange={(e) => reset(setMethod)(e.target.value)}>
              <option value="">{t('filter.all')}</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`method.${m}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('filter.person')}>
            <select value={member} onChange={(e) => reset(setMember)(e.target.value)}>
              <option value="">{t('filter.everyone')}</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {exportError != null && <ErrorNotice error={exportError} />}
      {report.error && <ErrorNotice error={report.error} onRetry={report.reload} />}
      {s && (
        <div className="kpis compact">
          <Kpi label={t('kpi.sales')} value={money(s.totalMinor)} hint={t('kpi.count', { count: s.count })} />
          <Kpi label={t('kpi.ticket')} value={money(s.averageTicketMinor)} />
          <Kpi label={t('kpi.discounts')} value={money(s.discountMinor)} />
          <Kpi label={t('kpi.cancelled')} value={s.cancelledCount} tone={s.cancelledCount > 0 ? 'orange' : undefined} />
        </div>
      )}
      {report.data && (report.data.byMethod?.length ?? 0) > 0 && (
        <Card title={t('byMethod')}>
          <div className="ventas-methods">
            {(report.data.byMethod ?? []).map((m) => (
              <Tag key={m.method} tone={m.method === 'CREDIT' ? 'orange' : 'neutral'}>
                {t(`method.${m.method}`, { defaultValue: m.method })}: {money(m.amountMinor)}
              </Tag>
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
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t('empty')} onRowClick={setSelected} />
          <Pager page={page} size={PAGE_SIZE} total={list.data?.total ?? 0} onChange={setPage} />
        </>
      )}

      <SaleDetail sale={selected} onClose={() => setSelected(null)} onCancel={(sale) => setToCancel(sale)} />
      <ReasonDialog
        open={toCancel !== null}
        title={t('cancel.title')}
        body={t('cancel.body', { total: toCancel ? money(toCancel.totalMinor) : '' })}
        confirmLabel={t('cancel.confirm')}
        onClose={() => setToCancel(null)}
        onConfirm={async (reason) => {
          if (!toCancel) return
          await call(client.POST('/api/b/{businessId}/sales/{saleId}/cancel', { params: { path: { businessId, saleId: toCancel.id } }, body: { reason: reason || undefined } }))
          setSelected(null)
          list.reload()
          report.reload()
        }}
      />
    </Page>
  )
}
