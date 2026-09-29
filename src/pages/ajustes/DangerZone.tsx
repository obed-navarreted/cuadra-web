import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useAuth, useBusiness } from '../../auth/context'
import { Button, Card, ErrorNotice, Field } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useAsync } from '../../hooks/useAsync'

type Member = { id?: string; displayName?: string; role?: string; status?: string; hasGoogle: boolean }

/** Solo dueño: pasar la propiedad a otra persona con Google y pedir la eliminación del negocio (con 30 días de gracia). */
export function DangerZone() {
  const { t } = useTranslation('ajustes')
  const { membership, business } = useBusiness()
  const { reloadBusiness } = useAuth()
  const businessId = membership.businessId ?? ''
  const members = useAsync(async () => (await call(client.GET('/api/b/{businessId}/members', { params: { path: { businessId } } }))) as Member[], [businessId])
  const candidates = (members.data ?? []).filter((m) => m.status === 'ACTIVE' && m.role !== 'OWNER' && m.hasGoogle)
  const [target, setTarget] = useState('')
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const name = business.name ?? ''
  const deleting = business.status === 'DELETING'

  async function transfer() {
    setBusy(true)
    setFailure(null)
    try {
      await call(client.POST('/api/b/{businessId}/owner-transfer', { params: { path: { businessId } }, body: { memberId: target } }))
      // Tu rol cambió (ahora eres admin): se recarga todo para que el panel muestre lo que te corresponde.
      window.location.reload()
    } catch (e) {
      setFailure(e)
      setConfirmTransfer(false)
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setFailure(null)
    try {
      await call(client.DELETE('/api/b/{businessId}', { params: { path: { businessId } } }))
      setConfirmDelete(false)
      setTyped('')
      await reloadBusiness()
    } catch (e) {
      setFailure(e)
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('danger.title')}>
      {failure != null && <ErrorNotice error={failure} />}
      <div className="page">
        <h3 style={{ margin: 0 }}>{t('danger.transferTitle')}</h3>
        <p className="muted">{t('danger.transferBody')}</p>
        {candidates.length === 0 ? (
          <p className="notice warn">{t('danger.noCandidates')}</p>
        ) : (
          <div className="aj-actions" style={{ justifyContent: 'flex-start' }}>
            <Field label={t('danger.newOwner')}>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{t('danger.pick')}</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={!target} onClick={() => setConfirmTransfer(true)}>
              {t('danger.transfer')}
            </Button>
          </div>
        )}
      </div>

      <div className="page aj-danger" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <h3 style={{ margin: 0, color: 'var(--red)' }}>{t('danger.deleteTitle')}</h3>
        {deleting ? <p className="notice error">{t('danger.deleting')}</p> : <p className="muted">{t('danger.deleteBody')}</p>}
        {!deleting && (
          <div className="aj-actions" style={{ justifyContent: 'flex-start' }}>
            <Button kind="danger" onClick={() => setConfirmDelete(true)}>
              {t('danger.delete')}
            </Button>
          </div>
        )}
      </div>

      <Modal open={confirmTransfer} title={t('danger.transferConfirmTitle')} onClose={() => setConfirmTransfer(false)}>
        <p>{t('danger.transferConfirmBody', { name: candidates.find((m) => m.id === target)?.displayName ?? '' })}</p>
        <div className="aj-actions">
          <Button onClick={() => setConfirmTransfer(false)}>{t('cancel')}</Button>
          <Button kind="danger" disabled={busy} onClick={() => void transfer()}>
            {t('danger.transfer')}
          </Button>
        </div>
      </Modal>
      <Modal open={confirmDelete} title={t('danger.deleteConfirmTitle')} onClose={() => (setConfirmDelete(false), setTyped(''))}>
        <p>{t('danger.deleteConfirmBody')}</p>
        <Field label={t('danger.typeName', { name })}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <div className="aj-actions">
          <Button onClick={() => (setConfirmDelete(false), setTyped(''))}>{t('cancel')}</Button>
          <Button kind="danger" disabled={busy || typed.trim() !== name.trim() || !name.trim()} onClick={() => void remove()}>
            {t('danger.delete')}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
