import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Button, Card, EmptyState, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { formatHm } from '../../lib/dates'
import { ScheduleEditor, type Member } from './ScheduleEditor'
import { draftOf, emptyDraft, summarize, buildInput, type Draft, type ScheduleView } from './schedule'

/** Programaciones de avisos (dueño y admins). Todo con conexión: no hay copia local. */
export function Schedules() {
  const { t } = useTranslation('avisos')
  const { membership } = useBusiness()
  const businessId = membership.businessId ?? ''
  const f = useFormat()
  const list = useAsync(() => call(client.GET('/api/b/{businessId}/notification-schedules', { params: { path: { businessId } } })), [businessId])
  const members = useAsync(async () => (await call(client.GET('/api/b/{businessId}/members', { params: { path: { businessId } } }))) as Member[], [businessId])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<ScheduleView | null>(null)
  const [history, setHistory] = useState<ScheduleView | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      list.reload()
    } catch (e) {
      setFailure(e)
    } finally {
      setBusy(false)
    }
  }

  const active = ((members.data ?? []) as Member[]).filter((m) => m.status === 'ACTIVE')
  const rows = (list.data ?? []) as ScheduleView[]

  return (
    <div className="page">
      <div className="row">
        <p className="muted grow">{t('sched.hint')}</p>
        <Button kind="primary" onClick={() => setEditing(emptyDraft())}>
          {t('sched.new')}
        </Button>
      </div>
      {failure != null && <ErrorNotice error={failure} />}
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Spinner />}
      {list.data && rows.length === 0 && <EmptyState>{t('sched.empty')}</EmptyState>}
      {rows.map((s) => {
        const once = s.rule?.type === 'ONCE'
        const sentOnce = once && !s.active && s.lastRunAt != null && s.nextRunAt == null
        return (
          <Card key={s.id}>
            <div className="sched-card">
              <div className="sched-head">
                <h2 className="grow">{s.title}</h2>
                {s.nextRunAt == null && (sentOnce ? <Tag tone="green">{t('sched.sentTag')}</Tag> : s.active ? <Tag>{t('sched.ended')}</Tag> : <Tag tone="orange">{t('sched.paused')}</Tag>)}
              </div>
              <p>{s.body}</p>
              <p className="b">{ruleText(t, s)}</p>
              <p className="muted small">{audienceText(t, s, active)}</p>
              {s.nextRunAt && (
                <p className="small" style={{ color: 'var(--green)' }}>
                  {t('sched.next', { when: f.dateTime(s.nextRunAt) })}
                </p>
              )}
              <p className="muted small">{t('sched.counts', { sent: s.sent, read: s.read })}</p>
              <div className="sched-actions">
                {!sentOnce && (
                  <Button small disabled={busy} onClick={() => void run(() => call(client.POST('/api/b/{businessId}/notification-schedules/{id}/active', { params: { path: { businessId, id: s.id } }, body: { active: !s.active } })))}>
                    {s.active ? t('actions.pause') : t('actions.resume')}
                  </Button>
                )}
                <Button small onClick={() => setEditing(draftOf(s))}>
                  {t('actions.edit')}
                </Button>
                <Button
                  small
                  disabled={busy}
                  onClick={() => void run(() => call(client.PUT('/api/b/{businessId}/notification-schedules/{id}', { params: { path: { businessId, id: crypto.randomUUID() } }, body: buildInput({ ...draftOf(s), title: `${s.title} ${t('sched.copySuffix')}`.slice(0, 100) }) })))}
                >
                  {t('actions.duplicate')}
                </Button>
                <Button small onClick={() => setHistory(s)}>
                  {t('actions.history')}
                </Button>
                <Button small kind="danger" onClick={() => setDeleting(s)}>
                  {t('actions.delete')}
                </Button>
              </div>
            </div>
          </Card>
        )
      })}

      {editing && (
        <ScheduleEditor
          initial={editing}
          members={active}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            list.reload()
          }}
        />
      )}
      <Modal open={deleting != null} title={t('delete.title')} onClose={() => setDeleting(null)}>
        <p>{t('delete.body', { title: deleting?.title ?? '' })}</p>
        <div className="sched-actions-row">
          <Button onClick={() => setDeleting(null)}>{t('actions.cancel')}</Button>
          <Button
            kind="danger"
            disabled={busy}
            onClick={() => {
              const id = deleting?.id
              setDeleting(null)
              if (id) void run(() => call(client.DELETE('/api/b/{businessId}/notification-schedules/{id}', { params: { path: { businessId, id } } })))
            }}
          >
            {t('actions.delete')}
          </Button>
        </div>
      </Modal>
      {history && <History schedule={history} onClose={() => setHistory(null)} />}
    </div>
  )
}

function History({ schedule, onClose }: { schedule: ScheduleView; onClose: () => void }) {
  const { t } = useTranslation('avisos')
  const { membership } = useBusiness()
  const businessId = membership.businessId ?? ''
  const f = useFormat()
  const runs = useAsync(() => call(client.GET('/api/b/{businessId}/notification-schedules/{id}/runs', { params: { path: { businessId, id: schedule.id } } })), [businessId, schedule.id])
  return (
    <Modal open title={t('history.title', { title: schedule.title })} onClose={onClose}>
      {runs.error && <ErrorNotice error={runs.error} onRetry={runs.reload} />}
      {runs.loading && !runs.data && <Spinner />}
      {runs.data && runs.data.length === 0 && <EmptyState>{t('history.empty')}</EmptyState>}
      {(runs.data ?? []).map((r) => (
        <div key={r.runAt} className="pref-row">
          <span>{r.runAt ? f.dateTime(r.runAt) : ''}</span>
          <span>
            <Tag tone={r.status === 'SENT' ? 'green' : 'orange'}>{t(`history.status.${r.status}`, { defaultValue: r.status ?? '' })}</Tag> {t('history.recipients', { count: r.recipients })}
          </span>
        </div>
      ))}
      <div className="sched-actions-row">
        <Button onClick={onClose}>{t('actions.close')}</Button>
      </div>
    </Modal>
  )
}

function ruleText(t: ReturnType<typeof useTranslation>['t'], s: ScheduleView): string {
  const r = summarize(s.rule ?? { type: 'DAILY' })
  switch (r.kind) {
    case 'once':
      return t('rule.once', { date: r.date, time: formatHm(r.time) })
    case 'daily':
      return t('rule.daily', { time: formatHm(r.time) })
    case 'weekly':
      return t('rule.weekly', { days: r.days.map((d) => t(`weekday.${d}`)).join(' '), time: formatHm(r.time) })
    case 'monthly':
      return t('rule.monthly', { day: r.day, time: formatHm(r.time) })
    case 'everyN':
      return t('rule.everyN', { n: r.n, time: formatHm(r.time) })
  }
}

function audienceText(t: ReturnType<typeof useTranslation>['t'], s: ScheduleView, members: Member[]): string {
  const a = s.audience ?? {}
  if (a.all) return t('audience.all')
  const parts: string[] = (a.roles ?? []).map((r) => t(`audience.role.${r}`, { defaultValue: r }))
  const names = (a.memberIds ?? []).map((id) => members.find((m) => m.id === id)?.displayName).filter(Boolean)
  if (names.length) parts.push(names.join(', '))
  return parts.join(' · ')
}
