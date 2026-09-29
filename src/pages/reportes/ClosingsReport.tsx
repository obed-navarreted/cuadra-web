import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { DataTable } from '../../components/DataTable'
import { Card, ErrorNotice, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { CsvButton, Difference } from './shared'
import type { MemberClosings, ShiftLine } from './types'

/** Historial de diferencias de cierre por persona; cada persona se despliega para ver sus cierres uno por uno. */
export function ClosingsReport({ businessId, range }: { businessId: string; range: DateRange }) {
  const { t } = useTranslation('reportes')
  const { money, dateTime } = useFormat()
  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/closings', { params: { path: { businessId }, query: { from: range.from, to: range.to } } })), [businessId, range.from, range.to])
  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />

  return (
    <Card title={t('tabs.closings')} actions={<CsvButton path={`/api/b/${businessId}/reports/closings.csv`} params={{ from: range.from, to: range.to }} />}>
      <DataTable
        columns={[
          { key: 'person', header: t('closings.person'), className: 'name-cell', cell: (m: MemberClosings) => m.name ?? '—' },
          { key: 'shifts', header: t('closings.shifts'), align: 'right', cell: (m) => m.shifts },
          { key: 'net', header: t('closings.net'), align: 'right', cell: (m) => <Difference minor={m.differenceMinor} /> },
          { key: 'abs', header: t('closings.absolute'), align: 'right', cell: (m) => money(m.absoluteDifferenceMinor) },
        ]}
        rows={state.data}
        rowKey={(m) => m.memberId ?? m.name ?? ''}
        empty={t('closings.empty')}
      />
      {state.data.map((m) => (
        <details className="closing-detail" key={m.memberId ?? m.name}>
          <summary>
            <strong>{m.name ?? '—'}</strong> · {t('closings.detail', { count: m.shifts })}
          </summary>
          <DataTable
            columns={[
              { key: 'reg', header: t('closings.register'), cell: (l: ShiftLine) => l.register ?? '—' },
              { key: 'at', header: t('closings.closedAt'), cell: (l) => (l.closedAt ? dateTime(l.closedAt) : '') },
              { key: 'exp', header: t('closings.expected'), align: 'right', cell: (l) => money(l.expectedMinor) },
              { key: 'cnt', header: t('closings.counted'), align: 'right', cell: (l) => money(l.countedMinor) },
              { key: 'diff', header: t('closings.difference'), align: 'right', cell: (l) => <Difference minor={l.differenceMinor} /> },
            ]}
            rows={m.lines ?? []}
            rowKey={(l) => l.shiftId ?? ''}
            empty={t('closings.empty')}
          />
        </details>
      ))}
    </Card>
  )
}
