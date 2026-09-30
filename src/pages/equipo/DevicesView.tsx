import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { listDevices, revokeDevice, type Device } from './api'

export function DevicesView() {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const { dateTime } = useFormat()
  const list = useAsync(() => listDevices(business.id), [business.id])
  const [revoking, setRevoking] = useState<Device | null>(null)
  const [revokeError, setRevokeError] = useState<unknown>(null)

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
      <p className="muted">{t('devices.note')}</p>
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
