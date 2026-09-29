import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { RangePicker } from '../../components/RangePicker'
import { ReasonDialog } from '../../components/ReasonDialog'
import { ErrorNotice, Field, Kpi, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { summarize, type Shift } from './logic'
import { OutcomeTag } from './OutcomeTag'
import { ShiftDetail } from './ShiftDetail'
import './cierres.css'

const PAGE = 100
const MAX_PAGES = 10

export default function CierresPage() {
  const { t } = useTranslation('cierres')
  const { business } = useBusiness()
  const businessId = business.id
  const { money, dateTime, today } = useFormat()
  const navigate = useNavigate()
  const openId = useParams()['*'] || null
  const [range, setRange] = useState<DateRange>(() => ({ from: today(), to: today() }))
  const [person, setPerson] = useState('')
  const [toReopen, setToReopen] = useState<Shift | null>(null)

  const members = useAsync(() => call(client.GET('/api/b/{businessId}/members', { params: { path: { businessId } } })), [businessId])
  // El servidor filtra por jornada de apertura y por persona (quien lo abrió o lo cerró); solo se piden páginas hasta la última.
  const shifts = useAsync(async () => {
    const all: Shift[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await call(client.GET('/api/b/{businessId}/shifts', { params: { path: { businessId }, query: { page, size: PAGE, from: range.from, to: range.to, member: person || undefined } } }))
      all.push(...((res.items ?? []) as Shift[]))
      if (res.last) break
    }
    return all
  }, [businessId, range.from, range.to, person])

  const detail = useAsync(async () => (openId ? await call(client.GET('/api/b/{businessId}/shifts/{shiftId}', { params: { path: { businessId, shiftId: openId } } })) : undefined), [businessId, openId])

  const rows = useMemo(() => shifts.data ?? [], [shifts.data])
  const sum = useMemo(() => summarize(rows), [rows])

  const columns: Column<Shift>[] = [
    { key: 'register', header: t('col.register'), cell: (s) => s.registerName ?? '—' },
    { key: 'opened', header: t('col.opened'), className: 'nowrap', cell: (s) => (<><div>{s.openedAt ? dateTime(s.openedAt) : '—'}</div><span className="muted small">{s.openedBy?.name}</span></>) },
    { key: 'closed', header: t('col.closed'), className: 'nowrap', cell: (s) => (s.closedAt ? (<><div>{dateTime(s.closedAt)}</div><span className="muted small">{s.closedBy?.name}</span></>) : <Tag tone="green">{t('status.OPEN')}</Tag>) },
    { key: 'expected', header: t('col.expected'), align: 'right', cell: (s) => (s.expectedAtCloseMinor == null ? '—' : money(s.expectedAtCloseMinor)) },
    { key: 'counted', header: t('col.counted'), align: 'right', cell: (s) => (s.countedMinor == null ? '—' : money(s.countedMinor)) },
    { key: 'diff', header: t('col.difference'), cell: (s) => <OutcomeTag differenceMinor={s.differenceMinor} /> },
    {
      key: 'flags',
      header: t('col.flags'),
      cell: (s) => (
        <span className="flags">
          {s.forcedReason && <Tag tone="orange">{t('flag.forced')}</Tag>}
          {s.lateOps > 0 && <Tag tone="orange">{t('flag.late', { count: s.lateOps })}</Tag>}
          {s.reopenedCount > 0 && <Tag>{t('flag.reopened', { count: s.reopenedCount })}</Tag>}
        </span>
      ),
    },
  ]

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <div className="cierres-filters">
        <RangePicker value={range} onChange={setRange} />
        <div className="selects">
          <Field label={t('filter.person')}>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
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
      <div className="kpis compact">
        <Kpi label={t('kpi.closed')} value={sum.closed} hint={sum.open > 0 ? t('kpi.open', { count: sum.open }) : undefined} />
        <Kpi label={t('kpi.net')} value={money(sum.net)} tone={sum.net < 0 ? 'red' : undefined} hint={t('kpi.netHint')} />
        <Kpi label={t('kpi.absolute')} value={money(sum.absolute)} hint={t('kpi.absoluteHint')} />
        <Kpi label={t('kpi.forced')} value={sum.forced} tone={sum.forced > 0 ? 'orange' : undefined} />
      </div>
      {shifts.error ? (
        <ErrorNotice error={shifts.error} onRetry={shifts.reload} />
      ) : shifts.loading && !shifts.data ? (
        <Spinner />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} empty={t('empty')} onRowClick={(s) => navigate(`/cierres/${s.id}`)} />
      )}
      {openId && <ShiftDetail shift={detail.data} loading={detail.loading} error={detail.error} onRetry={detail.reload} onClose={() => navigate('/cierres')} onReopen={setToReopen} />}
      <ReasonDialog
        open={toReopen !== null}
        title={t('reopen.title')}
        body={t('reopen.body')}
        confirmLabel={t('reopen.confirm')}
        required
        onClose={() => setToReopen(null)}
        onConfirm={async (reason) => {
          if (!toReopen) return
          await call(client.POST('/api/b/{businessId}/shifts/{shiftId}/reopen', { params: { path: { businessId, shiftId: toReopen.id } }, body: { reason } }))
          navigate('/cierres')
          shifts.reload()
        }}
      />
    </Page>
  )
}
