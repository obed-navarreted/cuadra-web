import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../../components/DataTable'
import { Card, ErrorNotice, Field, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { searchUsers, type UserRow } from './api'
import { useConsoleFormat } from './format'

export function UsersPage() {
  const { t } = useTranslation('consola')
  const { dateTime, language } = useConsoleFormat()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 300)
    return () => window.clearTimeout(id)
  }, [q])
  const list = useAsync(() => (term ? searchUsers(term) : Promise.resolve([] as UserRow[])), [term])

  const columns: Column<UserRow>[] = [
    {
      key: 'user',
      header: t('users.col.user'),
      cell: (u) => (
        <div>
          <strong>{u.fullName ?? '—'}</strong> {u.platformAdmin && <Tag tone="orange">{t('users.admin')}</Tag>}
          <div className="muted small">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'businesses',
      header: t('users.col.businesses'),
      cell: (u) => ((u.businesses ?? []).length ? <ul className="plain">{(u.businesses ?? []).map((b) => <li key={b}>{b}</li>)}</ul> : <span className="muted">{t('users.noBusinesses')}</span>),
    },
    { key: 'locale', header: t('users.col.locale'), cell: (u) => language(u.locale) },
    { key: 'lastLogin', header: t('users.col.lastLogin'), cell: (u) => dateTime(u.lastLoginAt) },
  ]

  return (
    <Page title={t('nav.users')} subtitle={t('users.subtitle')}>
      <Card>
        <Field label={t('users.search')} hint={t('users.searchHint')}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </Card>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!term ? <p className="muted">{t('users.prompt')}</p> : !list.data && !list.error ? <Spinner /> : list.data && <DataTable columns={columns} rows={list.data} rowKey={(u) => u.id} empty={t('users.empty')} />}
    </Page>
  )
}
