import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { claimDevice, listDevices, revokeDevice, type Device } from './api'
import { normalizeCode } from './lib'

export function DevicesView() {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const { dateTime } = useFormat()
  const list = useAsync(() => listDevices(business.id), [business.id])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [linked, setLinked] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Device | null>(null)
  const [revokeError, setRevokeError] = useState<unknown>(null)

  async function claim(e: FormEvent) {
    e.preventDefault()
    const clean = normalizeCode(code)
    if (!clean) return
    setBusy(true)
    setError(null)
    setLinked(null)
    try {
      const d = await claimDevice(business.id, clean, name)
      setLinked(d.name ?? clean)
      setCode('')
      setName('')
      list.reload()
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  const columns: Column<Device>[] = [
    {
      key: 'name',
      header: t('devices.col.name'),
      cell: (d) => (
        <div>
          <strong>{d.name}</strong>
          <div className="muted small">{[d.model, d.appVersion && t('devices.version', { version: d.appVersion })].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    { key: 'register', header: t('devices.col.register'), cell: (d) => d.cashRegisterName ?? <span className="muted">—</span> },
    { key: 'sync', header: t('devices.col.sync'), cell: (d) => (d.lastSyncAt ? dateTime(d.lastSyncAt) : <span className="muted">{t('devices.never')}</span>) },
    { key: 'pending', header: t('devices.col.pending'), align: 'right', cell: (d) => (d.pendingOps > 0 ? <Tag tone="orange">{d.pendingOps}</Tag> : <span className="muted">0</span>) },
    { key: 'linked', header: t('devices.col.linked'), cell: (d) => (d.linkedAt ? dateTime(d.linkedAt) : '—') },
    {
      key: 'act',
      header: '',
      cell: (d) =>
        d.revoked ? (
          <Tag tone="red">{t('devices.revoked')}</Tag>
        ) : (
          <Button small onClick={() => (setRevokeError(null), setRevoking(d))}>
            {t('devices.revoke')}
          </Button>
        ),
    },
  ]

  return (
    <div className="stack">
      <Card title={t('devices.linkTitle')}>
        <p className="muted">{t('devices.linkHint')}</p>
        <form className="toolbar-row" onSubmit={claim}>
          <Field label={t('devices.code')}>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16} className="code-input" required />
          </Field>
          <Field label={t('devices.nameLabel')}>
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" kind="primary" disabled={busy || !normalizeCode(code)}>
            {t('devices.link')}
          </Button>
        </form>
        {error != null && <ErrorNotice error={error} />}
        {linked && (
          <p className="notice ok" role="status">
            {t('devices.linked', { name: linked })}
          </p>
        )}
      </Card>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Spinner /> : <DataTable columns={columns} rows={list.data ?? []} rowKey={(d) => d.id} empty={t('devices.empty')} />}
      {revoking && (
        <Modal open title={t('devices.revokeTitle')} onClose={() => setRevoking(null)}>
          <p>{t('devices.revokeBody', { name: revoking.name })}</p>
          {revoking.pendingOps > 0 && <p className="notice warn">{t('devices.revokePending', { count: revoking.pendingOps })}</p>}
          {revokeError != null && <ErrorNotice error={revokeError} />}
          <div className="dialog-actions">
            <Button onClick={() => setRevoking(null)}>{t('cancel')}</Button>
            <Button
              kind="danger"
              onClick={async () => {
                try {
                  await revokeDevice(business.id, revoking.id)
                  setRevoking(null)
                  list.reload()
                } catch (err) {
                  setRevokeError(err)
                }
              }}
            >
              {t('devices.revoke')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
