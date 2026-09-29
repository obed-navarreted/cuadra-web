import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '../../components/DataTable'
import { Pager } from '../../components/Pager'
import { ErrorNotice, Page, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { listAudit, type AuditEntry } from './api'
import { useConsoleFormat } from './format'

const SIZE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function AuditPage() {
  const { t } = useTranslation('consola')
  const { dateTime } = useConsoleFormat()
  const [page, setPage] = useState(0)
  const list = useAsync(() => listAudit(page, SIZE), [page])

  const columns: Column<AuditEntry>[] = [
    { key: 'at', header: t('audit.col.at'), cell: (e) => dateTime(e.at) },
    { key: 'actor', header: t('audit.col.actor'), cell: (e) => e.actorEmail ?? '—' },
    { key: 'action', header: t('audit.col.action'), cell: (e) => <code>{e.action}</code> },
    { key: 'target', header: t('audit.col.target'), cell: (e) => (e.target && UUID.test(e.target) && e.action?.startsWith('business.') ? <Link to={`/console/negocios/${e.target}`}>{e.target.slice(0, 8)}…</Link> : (e.target ?? '—')) },
    { key: 'payload', header: t('audit.col.payload'), cell: (e) => <span className="wrap">{e.payload ?? '—'}</span> },
  ]

  return (
    <Page title={t('nav.audit')} subtitle={t('audit.subtitle')}>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Spinner />}
      {list.data && (
        <>
          <DataTable columns={columns} rows={list.data.items ?? []} rowKey={(e) => String(e.id)} empty={t('audit.empty')} />
          <Pager page={page} size={SIZE} total={list.data.total} onChange={setPage} />
        </>
      )}
    </Page>
  )
}
