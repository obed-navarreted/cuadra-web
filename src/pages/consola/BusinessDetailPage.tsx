import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { startViewAs } from '../../auth/session'
import { ReasonDialog } from '../../components/ReasonDialog'
import { Button, Card, ErrorNotice, Field, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { changePlan, extendTrial, getBusiness, markDeletion, setFlag, suspend, unsuspend, viewAs, type BusinessDetail } from './api'
import { useConsoleFormat } from './format'
import { FLAG_KEYS, PLANS, PLAN_STATUSES, REASON_MIN, localToIso } from './lib'
import { BusinessStatusTag } from './StatusTag'

type Action = { kind: 'plan' } | { kind: 'trial' } | { kind: 'suspend' } | { kind: 'unsuspend' } | { kind: 'delete' } | { kind: 'viewas' } | { kind: 'flag'; key: string; enabled: boolean }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <dt className="muted small">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** ISO → valor de un `datetime-local` (hora del navegador). */
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function BusinessDetailPage() {
  const { t } = useTranslation('consola')
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { dateTime, country, orNone, number } = useConsoleFormat()
  const q = useAsync(() => getBusiness(id), [id])
  const [action, setAction] = useState<Action | null>(null)
  const [plan, setPlan] = useState<string>('PRO')
  const [planStatus, setPlanStatus] = useState<string>('MANUAL')
  const [periodEnd, setPeriodEnd] = useState('')
  const [note, setNote] = useState('')
  const [days, setDays] = useState('14')
  const [typed, setTyped] = useState('')
  const b: BusinessDetail | undefined = q.data

  function open(a: Action) {
    if (a.kind === 'plan' && b) {
      setPlan(b.plan === 'FREE' ? 'FREE' : 'PRO')
      setPlanStatus(b.planStatus && (PLAN_STATUSES as readonly string[]).includes(b.planStatus) ? b.planStatus : 'MANUAL')
      setPeriodEnd(toLocalInput(b.currentPeriodEnd))
      setNote(b.planNote ?? '')
    }
    if (a.kind === 'trial') setDays('14')
    if (a.kind === 'delete') setTyped('')
    setAction(a)
  }
  const done = () => q.reload()
  const close = () => setAction(null)

  const daysNum = Number(days)
  const daysOk = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 365

  if (q.error && !b) {
    return (
      <Page title={t('detail.title')}>
        <ErrorNotice error={q.error} onRetry={q.reload} />
        <Link to="/console/negocios">{t('detail.back')}</Link>
      </Page>
    )
  }
  if (!b) {
    return (
      <Page title={t('detail.title')}>
        <Spinner />
      </Page>
    )
  }
  const suspended = b.status === 'SUSPENDED'
  const name = b.name ?? ''

  return (
    <Page
      title={name}
      subtitle={
        <>
          <Link to="/console/negocios">{t('detail.back')}</Link> · <BusinessStatusTag status={b.status} />
        </>
      }
    >
      {q.error && <ErrorNotice error={q.error} onRetry={q.reload} />}
      {suspended && (
        <div className="notice warn" role="status">
          <span className="grow">
            {t('detail.suspendedBanner', { reason: b.suspendedReason ?? '—', at: dateTime(b.suspendedAt) })}
          </span>
        </div>
      )}
      <div className="grid-2">
        <Card title={t('detail.general')}>
          <dl className="kvs">
            <Row label={t('detail.type')}>{orNone(b.type)}</Row>
            <Row label={t('detail.country')}>{country(b.country)}</Row>
            <Row label={t('detail.currency')}>{b.currency ?? '—'}</Row>
            <Row label={t('detail.timezone')}>{b.timezone ?? '—'}</Row>
            <Row label={t('detail.created')}>{dateTime(b.createdAt)}</Row>
            <Row label={t('detail.members')}>{number(b.members)}</Row>
            <Row label={t('detail.devices')}>{number(b.devices)}</Row>
            <Row label={t('detail.sales30')}>{number(b.sales30)}</Row>
            <Row label={t('detail.openTickets')}>{number(b.openTickets)}</Row>
          </dl>
        </Card>
        <Card title={t('detail.plan')}>
          <dl className="kvs">
            <Row label={t('detail.effectivePlan')}>
              <Tag tone={b.effectivePlan === 'PRO' ? 'green' : 'neutral'}>{t(`plan.${b.effectivePlan}`, { defaultValue: b.effectivePlan ?? '—' })}</Tag>
            </Row>
            <Row label={t('detail.subscription')}>
              {b.plan ? `${t(`plan.${b.plan}`, { defaultValue: b.plan })} · ${t(`planStatus.${b.planStatus}`, { defaultValue: b.planStatus ?? '' })}` : '—'}
            </Row>
            <Row label={t('detail.trialEnds')}>{dateTime(b.trialEndsAt)}</Row>
            <Row label={t('detail.periodEnd')}>{dateTime(b.currentPeriodEnd)}</Row>
            <Row label={t('detail.planNote')}>{b.planNote || '—'}</Row>
          </dl>
        </Card>
      </div>

      <Card title={t('detail.owners')}>
        {(b.owners ?? []).length === 0 ? (
          <p className="muted">{t('detail.noOwners')}</p>
        ) : (
          <ul className="plain">
            {(b.owners ?? []).map((o) => (
              <li key={o.userId ?? o.email}>
                <strong>{o.fullName ?? '—'}</strong> <span className="muted">{o.email}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('detail.flags')}>
        <p className="muted small">{t('detail.flagsHint')}</p>
        <div className="flags">
          {FLAG_KEYS.map((key) => {
            const on = b.flags?.[key] === true
            return (
              <label key={key} className="flag">
                <input type="checkbox" checked={on} onChange={() => open({ kind: 'flag', key, enabled: !on })} />
                <span>
                  <strong>{t(`flags.${key}`)}</strong>
                  <span className="muted small"> {t(`flags.${key}Hint`)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </Card>

      <Card title={t('detail.actions')}>
        <div className="row">
          <Button kind="primary" onClick={() => open({ kind: 'viewas' })}>
            {t('actions.viewAs')}
          </Button>
          <Button onClick={() => open({ kind: 'plan' })}>{t('actions.changePlan')}</Button>
          <Button onClick={() => open({ kind: 'trial' })}>{t('actions.extendTrial')}</Button>
          {suspended ? <Button onClick={() => open({ kind: 'unsuspend' })}>{t('actions.unsuspend')}</Button> : <Button onClick={() => open({ kind: 'suspend' })}>{t('actions.suspend')}</Button>}
          <Button kind="danger" onClick={() => open({ kind: 'delete' })}>
            {t('actions.markDeletion')}
          </Button>
        </div>
        <p className="muted small">{t('actions.reasonNote')}</p>
      </Card>

      <ReasonDialog
        open={action?.kind === 'viewas'}
        title={t('viewAs.dialogTitle', { business: name })}
        body={t('viewAs.dialogBody')}
        confirmLabel={t('viewAs.start')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        onClose={close}
        onConfirm={async (reason) => {
          const res = await viewAs(id, reason)
          if (!res.token) return
          startViewAs(res.token, { businessId: id, businessName: name, expiresAt: res.expiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString() })
          navigate('/resumen')
        }}
      />
      <ReasonDialog
        open={action?.kind === 'plan'}
        title={t('planDialog.title')}
        confirmLabel={t('planDialog.save')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        onClose={close}
        onConfirm={async (reason) => {
          await changePlan(id, { plan, status: planStatus, periodEnd: localToIso(periodEnd) ?? undefined, note: note.trim() || undefined }, reason)
          done()
        }}
        extra={
          <div className="stack">
            <Field label={t('planDialog.plan')}>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {t(`plan.${p}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('planDialog.status')}>
              <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value)}>
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`planStatus.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('planDialog.periodEnd')} hint={t('planDialog.periodEndHint')}>
              <input type="datetime-local" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Field>
            <Field label={t('planDialog.note')}>
              <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        }
      />
      <ReasonDialog
        open={action?.kind === 'trial'}
        title={t('trialDialog.title')}
        body={t('trialDialog.body')}
        confirmLabel={t('trialDialog.confirm')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        canConfirm={daysOk}
        onClose={close}
        onConfirm={async (reason) => {
          await extendTrial(id, daysNum, reason)
          done()
        }}
        extra={
          <Field label={t('trialDialog.days')} hint={t('trialDialog.daysHint')}>
            <input type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        }
      />
      <ReasonDialog
        open={action?.kind === 'suspend'}
        title={t('suspendDialog.title', { business: name })}
        body={t('suspendDialog.body')}
        confirmLabel={t('actions.suspend')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        onClose={close}
        onConfirm={async (reason) => {
          await suspend(id, reason)
          done()
        }}
      />
      <ReasonDialog
        open={action?.kind === 'unsuspend'}
        title={t('unsuspendDialog.title', { business: name })}
        confirmLabel={t('actions.unsuspend')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        onClose={close}
        onConfirm={async (reason) => {
          await unsuspend(id, reason)
          done()
        }}
      />
      <ReasonDialog
        open={action?.kind === 'delete'}
        title={t('deleteDialog.title', { business: name })}
        body={<strong>{t('deleteDialog.body')}</strong>}
        confirmLabel={t('actions.markDeletion')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        canConfirm={typed.trim() === name.trim() && name.trim() !== ''}
        onClose={close}
        onConfirm={async (reason) => {
          await markDeletion(id, reason)
          done()
        }}
        extra={
          <Field label={t('deleteDialog.type', { business: name })}>
            <input value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          </Field>
        }
      />
      <ReasonDialog
        open={action?.kind === 'flag'}
        title={action?.kind === 'flag' ? t(action.enabled ? 'flagDialog.enable' : 'flagDialog.disable', { flag: t(`flags.${action.key}`) }) : ''}
        confirmLabel={t('flagDialog.confirm')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        onClose={close}
        onConfirm={async (reason) => {
          if (action?.kind !== 'flag') return
          await setFlag(id, action.key, action.enabled, reason)
          done()
        }}
      />
    </Page>
  )
}
