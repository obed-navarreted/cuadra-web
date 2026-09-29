import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '../../components/DataTable'
import { Card, ErrorNotice, Field, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { listDevices, type DeviceRow } from './api'
import { useConsoleFormat } from './format'

export function DevicesPage() {
  const { t } = useTranslation('consola')
  const { dateTime, orNone } = useConsoleFormat()
  const [stale, setStale] = useState('')
  const [below, setBelow] = useState('')
  const [debounced, setDebounced] = useState({ stale: '', below: '' })
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced({ stale, below: below.trim() }), 300)
    return () => window.clearTimeout(id)
  }, [stale, below])
  const days = debounced.stale === '' ? undefined : Math.max(0, Math.floor(Number(debounced.stale)))
  const list = useAsync(() => listDevices(Number.isFinite(days) ? days : undefined, debounced.below), [days, debounced.below])

  const columns: Column<DeviceRow>[] = [
    {
      key: 'device',
      header: t('devices.col.device'),
      cell: (d) => (
        <div>
          <strong>{d.name ?? '—'}</strong>
          <div className="muted small">{d.model ?? '—'}</div>
        </div>
      ),
    },
    { key: 'business', header: t('devices.col.business'), cell: (d) => (d.businessId ? <Link to={`/console/negocios/${d.businessId}`}>{d.businessName}</Link> : '—') },
    { key: 'version', header: t('devices.col.version'), cell: (d) => orNone(d.appVersion) },
    { key: 'lastSync', header: t('devices.col.lastSync'), cell: (d) => (d.lastSyncAt ? dateTime(d.lastSyncAt) : <Tag tone="orange">{t('devices.neverSynced')}</Tag>) },
    { key: 'lastSeen', header: t('devices.col.lastSeen'), cell: (d) => dateTime(d.lastSeenAt) },
    { key: 'pending', header: t('devices.col.pending'), align: 'right', cell: (d) => (d.pendingOps > 0 ? <Tag tone="orange">{d.pendingOps}</Tag> : 0) },
  ]

  return (
    <Page title={t('nav.devices')} subtitle={t('devices.subtitle')}>
      <Card>
        <div className="filters">
          <Field label={t('devices.stale')} hint={t('devices.staleHint')}>
            <input type="number" inputMode="numeric" min={0} value={stale} onChange={(e) => setStale(e.target.value)} />
          </Field>
          <Field label={t('devices.below')} hint={t('devices.belowHint')}>
            <input value={below} placeholder="1.4.0" onChange={(e) => setBelow(e.target.value)} />
          </Field>
        </div>
      </Card>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Spinner />}
      {list.data && (
        <>
          <p className="muted small">{t('devices.total', { count: list.data.length })}</p>
          <DataTable columns={columns} rows={list.data} rowKey={(d) => d.id} empty={t('devices.empty')} />
        </>
      )}
    </Page>
  )
}
