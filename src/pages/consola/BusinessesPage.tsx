import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column } from '../../components/DataTable'
import { Pager } from '../../components/Pager'
import { Card, ErrorNotice, Field, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { listBusinesses, type BusinessRow } from './api'
import { useConsoleFormat } from './format'
import { PLANS, SHOW_PLANS } from './lib'
import { BusinessStatusTag } from './StatusTag'

const SIZE = 25

export function BusinessesPage() {
  const { t } = useTranslation('consola')
  const { date, dateTime, orNone } = useConsoleFormat()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [plan, setPlan] = useState('')
  const [cc, setCc] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(q.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(id)
  }, [q])

  const list = useAsync(() => listBusinesses({ q: debounced, plan, country: cc.trim().toUpperCase(), status, page, size: SIZE }), [debounced, plan, cc, status, page])

  const columns: Column<BusinessRow>[] = [
    {
      key: 'name',
      header: t('businesses.col.name'),
      cell: (b) => (
        <div>
          <strong>{b.name}</strong>
          <div className="muted small">{orNone(b.type)}</div>
        </div>
      ),
    },
    { key: 'country', header: t('businesses.col.country'), cell: (b) => b.country ?? '—' },
    { key: 'status', header: t('businesses.col.status'), cell: (b) => <BusinessStatusTag status={b.status} /> },
    ...(SHOW_PLANS ? ([
    {
      key: 'plan',
      header: t('businesses.col.plan'),
      cell: (b) => (
        <div>
          <Tag tone={b.effectivePlan === 'PRO' ? 'green' : 'neutral'}>{t(`plan.${b.effectivePlan}`, { defaultValue: b.effectivePlan ?? '—' })}</Tag>
          {b.plan && b.planStatus && (
            <div className="muted small">
              {t(`plan.${b.plan}`, { defaultValue: b.plan })} · {t(`planStatus.${b.planStatus}`, { defaultValue: b.planStatus })}
            </div>
          )}
        </div>
      ),
    }
    ] as Column<BusinessRow>[]) : []),
    { key: 'members', header: t('businesses.col.members'), align: 'right', cell: (b) => b.members },
    { key: 'devices', header: t('businesses.col.devices'), align: 'right', cell: (b) => b.devices },
    { key: 'lastSale', header: t('businesses.col.lastSale'), cell: (b) => dateTime(b.lastSaleAt) },
    { key: 'created', header: t('businesses.col.created'), cell: (b) => date(b.createdAt) },
  ]

  return (
    <Page title={t('nav.businesses')} subtitle={t('businesses.subtitle')}>
      <Card>
        <div className="filters">
          <Field label={t('businesses.search')} hint={t('businesses.searchHint')}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {SHOW_PLANS && (
            <Field label={t('businesses.col.plan')}>
              <select value={plan} onChange={(e) => (setPlan(e.target.value), setPage(0))}>
                <option value="">{t('all')}</option>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {t(`plan.${p}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('businesses.col.country')} hint={t('businesses.countryHint')}>
            <input value={cc} maxLength={2} onChange={(e) => (setCc(e.target.value), setPage(0))} />
          </Field>
          <Field label={t('businesses.col.status')}>
            <select value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))}>
              <option value="">{t('all')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
            </select>
          </Field>
        </div>
      </Card>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Spinner />}
      {list.data && (
        <>
          <p className="muted small">{t('businesses.total', { count: list.data.total })}</p>
          <DataTable columns={columns} rows={list.data.items ?? []} rowKey={(b) => b.id} empty={t('businesses.empty')} onRowClick={(b) => navigate(`/console/negocios/${b.id}`)} />
          <Pager page={page} size={SIZE} total={list.data.total} onChange={setPage} />
        </>
      )}
    </Page>
  )
}
