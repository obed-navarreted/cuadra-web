import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { createInvitation, listInvitations, revokeInvitation, type Invitation, type Role } from './api'
import { assignableRoles } from './lib'

/** Botón "Copiar" accesible: anuncia el resultado a lectores de pantalla y, si el navegador no deja copiar, lo dice (no falla en silencio). */
function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation('equipo')
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('ok')
    } catch {
      setState('fail')
    }
    setTimeout(() => setState('idle'), 2500)
  }
  return (
    <>
      <Button small onClick={() => void copy()}>
        {state === 'ok' ? t('invitations.copied') : label}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'ok' ? t('invitations.copied') : state === 'fail' ? t('invitations.copyFailed') : ''}
      </span>
    </>
  )
}

export function InvitationsView() {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const { dateTime } = useFormat()
  const list = useAsync(() => listInvitations(business.id), [business.id])
  const [creating, setCreating] = useState(false)
  const [shown, setShown] = useState<Invitation | null>(null)
  const [revoking, setRevoking] = useState<Invitation | null>(null)

  const columns: Column<Invitation>[] = [
    { key: 'role', header: t('members.col.role'), cell: (i) => <Tag tone={i.role === 'ADMIN' ? 'orange' : 'neutral'}>{t(`role.${i.role}`, { defaultValue: i.role })}</Tag> },
    { key: 'for', header: t('invitations.for'), cell: (i) => (i.email ? <span className="break">{i.email}</span> : <span className="muted">{t('invitations.anyone')}</span>) },
    { key: 'code', header: t('invitations.code'), cell: (i) => <code className="code">{i.code}</code> },
    { key: 'uses', header: t('invitations.uses'), cell: (i) => t('invitations.usesValue', { used: i.usedCount, max: i.maxUses }) },
    { key: 'exp', header: t('invitations.expires'), cell: (i) => (i.expiresAt ? dateTime(i.expiresAt) : '—') },
    {
      key: 'act',
      header: '',
      cell: (i) => (
        <div className="row-actions">
          {i.url && <CopyButton text={i.url} label={t('invitations.copyLink')} />}
          <Button small onClick={() => setRevoking(i)}>
            {t('invitations.revoke')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="stack">
      <div className="toolbar-row">
        <p className="muted grow">{t('invitations.hint')}</p>
        <Button kind="primary" onClick={() => setCreating(true)}>
          {t('invitations.new')}
        </Button>
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Spinner /> : <DataTable columns={columns} rows={list.data ?? []} rowKey={(i) => i.id} empty={t('invitations.empty')} />}
      {creating && (
        <NewInvitationDialog
          onClose={() => setCreating(false)}
          onCreated={(i) => {
            setCreating(false)
            setShown(i)
            list.reload()
          }}
        />
      )}
      {shown && (
        <Modal open title={t('invitations.createdTitle')} onClose={() => setShown(null)}>
          <p className="muted">{t('invitations.createdHint')}</p>
          {shown.code && (
            <div className="share">
              <code className="code big-code">{shown.code}</code>
              <CopyButton text={shown.code} label={t('invitations.copyCode')} />
            </div>
          )}
          {shown.url && (
            <div className="share">
              <span className="url grow">{shown.url}</span>
              <CopyButton text={shown.url} label={t('invitations.copyLink')} />
            </div>
          )}
          <div className="dialog-actions">
            <Button kind="primary" onClick={() => setShown(null)}>
              {t('close')}
            </Button>
          </div>
        </Modal>
      )}
      {revoking && (
        <Modal open title={t('invitations.revokeTitle')} onClose={() => setRevoking(null)}>
          <p>{t('invitations.revokeBody', { code: revoking.code })}</p>
          <div className="dialog-actions">
            <Button onClick={() => setRevoking(null)}>{t('cancel')}</Button>
            <Button
              kind="danger"
              onClick={async () => {
                await revokeInvitation(business.id, revoking.id).catch(() => undefined)
                setRevoking(null)
                list.reload()
              }}
            >
              {t('invitations.revoke')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function NewInvitationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (i: Invitation) => void }) {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const { isOwner } = useAuth()
  const [role, setRole] = useState<Role>('CASHIER')
  const [maxUses, setMaxUses] = useState('1')
  const [days, setDays] = useState('7')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const uses = Number(maxUses)
  const exp = Number(days)
  const emailOk = email.trim() === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const valid = Number.isInteger(uses) && uses >= 1 && uses <= 50 && Number.isInteger(exp) && exp >= 1 && exp <= 30 && emailOk

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createInvitation(business.id, { role, maxUses: uses, expiresInDays: exp, email: email.trim() || undefined }))
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={t('invitations.new')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <Field label={t('members.col.role')}>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {assignableRoles(isOwner).map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('invitations.email')} hint={t('invitations.emailHint')}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!emailOk} />
        </Field>
        <Field label={t('invitations.maxUses')} hint={t('invitations.maxUsesHint')}>
          <input type="number" min={1} max={50} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} aria-invalid={!valid} />
        </Field>
        <Field label={t('invitations.days')} hint={t('invitations.daysHint')}>
          <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} aria-invalid={!valid} />
        </Field>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !valid}>
            {t('invitations.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
