import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Field, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { createMember, listMembers, resetPin, updateMember, type Member, type Role } from './api'
import { CredentialsCard } from './CredentialsCard'
import { assignableRoles, canManage, COLORS, generatePin, isValidPin, newMemberIssue, PIN_LENGTH, sanitizePin } from './lib'

function RoleTag({ role }: { role: string }) {
  const { t } = useTranslation('equipo')
  return <Tag tone={role === 'OWNER' ? 'green' : role === 'ADMIN' ? 'orange' : 'neutral'}>{t(`role.${role}`, { defaultValue: role })}</Tag>
}

export function MembersView() {
  const { t } = useTranslation('equipo')
  const { business, membership } = useBusiness()
  const viewerRole = membership.role
  const members = useAsync(() => listMembers(business.id), [business.id])
  const [dialog, setDialog] = useState<{ kind: 'new' } | { kind: 'edit'; member: Member } | { kind: 'pin'; member: Member } | null>(null)

  const done = () => {
    setDialog(null)
    members.reload()
  }

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: t('members.col.username'),
      cell: (m) => (
        <div className="member-name">
          <span className="dot" style={{ background: m.color ?? 'var(--line-2)' }} aria-hidden="true" />
          <strong>{m.displayName}</strong>
          {m.id === membership.memberId && <span className="muted small">{t('members.you')}</span>}
        </div>
      ),
    },
    { key: 'role', header: t('members.col.role'), cell: (m) => <RoleTag role={m.role ?? 'CASHIER'} /> },
    { key: 'status', header: t('members.col.status'), cell: (m) => <Tag tone={m.status === 'ACTIVE' ? 'green' : 'red'}>{t(`status.${m.status}`, { defaultValue: m.status })}</Tag> },
    {
      key: 'access',
      header: t('members.col.access'),
      cell: (m) => (
        <div className="tags">
          {m.hasGoogle && <Tag>{t('members.google')}</Tag>}
          {m.pinSet ? <Tag>{t('members.pin')}</Tag> : !m.hasGoogle && <Tag tone="orange">{t('members.noPin')}</Tag>}
        </div>
      ),
    },
    {
      key: 'act',
      header: '',
      cell: (m) => {
        const self = m.id === membership.memberId
        const can = canManage(viewerRole, self, m.role)
        return (
          <div className="row-actions">
            {can.edit && (
              <Button small onClick={() => setDialog({ kind: 'edit', member: m })}>
                {t('members.edit')}
              </Button>
            )}
            {can.resetPin && (
              <Button small onClick={() => setDialog({ kind: 'pin', member: m })}>
                {t('members.resetPin')}
              </Button>
            )}
            {m.role === 'OWNER' && !self && <span className="muted small lock">{t('members.ownerLocked')}</span>}
          </div>
        )
      },
    },
  ]

  return (
    <div className="stack">
      <div className="toolbar-row">
        <p className="muted grow small">{t('members.hint')}</p>
        <Button kind="primary" onClick={() => setDialog({ kind: 'new' })}>
          {t('members.new')}
        </Button>
      </div>
      {members.error && <ErrorNotice error={members.error} onRetry={members.reload} />}
      {members.loading && !members.data ? <Spinner /> : <DataTable columns={columns} rows={members.data ?? []} rowKey={(m) => m.id} empty={t('members.empty')} />}
      {dialog?.kind === 'new' && <NewMemberDialog viewerRole={viewerRole} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && <EditMemberDialog member={dialog.member} self={dialog.member.id === membership.memberId} viewerRole={viewerRole} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'pin' && <PinDialog member={dialog.member} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  )
}

/** Campo de PIN con validación y "Generar": el PIN lo escribe (o genera) quien administra y se le muestra una sola vez. Con `pin2` pide repetirlo. */
function PinFields({ pin, setPin, pin2, setPin2, mustChange, setMustChange }: { pin: string; setPin: (p: string) => void; pin2?: string; setPin2?: (p: string) => void; mustChange: boolean; setMustChange: (v: boolean) => void }) {
  const { t } = useTranslation('equipo')
  const repeat = pin2 !== undefined && setPin2 !== undefined
  return (
    <>
      <div className="toolbar-row">
        <Field label={t('pin.label')} hint={t('pin.hint')}>
          <input inputMode="numeric" autoComplete="off" pattern="\d{5}" maxLength={PIN_LENGTH} value={pin} onChange={(e) => setPin(sanitizePin(e.target.value))} aria-invalid={pin !== '' && !isValidPin(pin)} required />
        </Field>
        {repeat && (
          <Field label={t('members.pinRepeat')}>
            <input inputMode="numeric" autoComplete="off" pattern="\d{5}" maxLength={PIN_LENGTH} value={pin2} onChange={(e) => setPin2(sanitizePin(e.target.value))} aria-invalid={pin2 !== '' && pin2 !== pin} required />
          </Field>
        )}
        <Button
          onClick={() => {
            const p = generatePin()
            setPin(p)
            setPin2?.(p)
          }}
        >
          {t('pin.generate')}
        </Button>
      </div>
      {repeat && pin2 !== '' && isValidPin(pin) && pin !== pin2 && <p className="notice warn">{t('members.pinMismatch')}</p>}
      <label className="check">
        <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} /> {t('pin.mustChange')}
      </label>
    </>
  )
}

/** Después de guardar, el PIN se ve UNA vez: el servidor solo guarda su huella y no hay forma de recuperarlo. */
function PinShown({ name, pin, onClose }: { name: string; pin: string; onClose: () => void }) {
  const { t } = useTranslation('equipo')
  return (
    <Modal open title={t('pin.savedTitle')} onClose={onClose}>
      <p>{t('pin.savedFor', { name })}</p>
      <output className="pin-shown" aria-label={t('pin.label')}>{pin}</output>
      <p className="notice warn">{t('pin.once')}</p>
      <div className="dialog-actions">
        <Button kind="primary" onClick={onClose}>
          {t('pin.written')}
        </Button>
      </div>
    </Modal>
  )
}

function NewMemberDialog({ viewerRole, onClose, onDone }: { viewerRole: string | null | undefined; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('CASHIER')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [mustChange, setMustChange] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [created, setCreated] = useState<string | null>(null)
  const valid = newMemberIssue(name, pin, pin2) === null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await createMember(business.id, { displayName: name.trim(), role, pin, mustChangePin: mustChange })
      setCreated(name.trim())
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  if (created) return <CredentialsCard name={created} pin={pin} onClose={onDone} />
  return (
    <Modal open title={t('members.new')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <p className="muted">{t('members.newHint')}</p>
        <Field label={t('members.nameLabel')} hint={t('members.nameHint')}>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t('members.col.role')}>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {assignableRoles(viewerRole).map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <PinFields pin={pin} setPin={setPin} pin2={pin2} setPin2={setPin2} mustChange={mustChange} setMustChange={setMustChange} />
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !valid}>
            {t('members.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function EditMemberDialog({ member, self, viewerRole, onClose, onDone }: { member: Member; self: boolean; viewerRole: string | null | undefined; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const [name, setName] = useState(member.displayName ?? '')
  const [color, setColor] = useState(member.color ?? '')
  const [role, setRole] = useState<Role>(member.role === 'ADMIN' ? 'ADMIN' : 'CASHIER')
  const [active, setActive] = useState(member.status === 'ACTIVE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // Uno mismo y el dueño no cambian de rol ni de estado; el servidor lo prohíbe igual.
  const can = canManage(viewerRole, self, member.role)
  const canRoleAndStatus = can.changeRole && can.disable

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await updateMember(business.id, member.id, {
        displayName: name.trim(),
        color: color || undefined,
        ...(canRoleAndStatus ? { role, status: active ? 'ACTIVE' : 'DISABLED' } : {}),
      })
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={t('members.edit')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <Field label={t('members.nameLabel')} hint={t('members.nameHint')}>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <fieldset className="colors">
          <legend className="field-label">{t('members.color')}</legend>
          <div className="chips">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`swatch${color === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
          </div>
        </fieldset>
        {canRoleAndStatus && (
          <>
            <Field label={t('members.col.role')}>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {assignableRoles(viewerRole).map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('members.activeLabel')}
            </label>
            {!active && <p className="notice warn">{t('members.disableHint')}</p>}
          </>
        )}
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !name.trim()}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PinDialog({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const [pin, setPin] = useState('')
  const [mustChange, setMustChange] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidPin(pin)) return
    setBusy(true)
    setError(null)
    try {
      await resetPin(business.id, member.id, pin, mustChange)
      setSaved(true)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  if (saved) return <PinShown name={member.displayName ?? ''} pin={pin} onClose={onDone} />
  return (
    <Modal open title={t('members.resetPinTitle', { name: member.displayName })} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <PinFields pin={pin} setPin={setPin} mustChange={mustChange} setMustChange={setMustChange} />
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !isValidPin(pin)}>
            {t('pin.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
