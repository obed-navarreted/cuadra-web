import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Button, Field, Tag } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { errorText } from '../../lib/errors'
import { BODY_MAX, BODY_RECOMMENDED, buildInput, LINKS, TITLE_MAX, TITLE_RECOMMENDED, validateDraft, type Draft, type Repeat, type When } from './schedule'

export type Member = { id?: string; displayName?: string; role?: string; status?: string }

/** Plantillas rápidas (PLAN 6.3): rellenan título y mensaje. */
const TEMPLATES = ['float', 'closing', 'supplier', 'credits'] as const

const REPEATS: Repeat[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS']
const WHENS: When[] = ['now', 'once', 'repeat']

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** Editor de una programación. Las horas son de la zona horaria del negocio y la pantalla lo dice. */
export function ScheduleEditor({ initial, members, onClose, onSaved }: { initial: Draft; members: Member[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('avisos')
  const { membership, business } = useBusiness()
  const businessId = membership.businessId ?? ''
  const [d, setD] = useState(initial)
  const [failure, setFailure] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const error = useMemo(() => validateDraft(d), [d])
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))

  async function submit() {
    setTried(true)
    if (error) return
    setBusy(true)
    setFailure(null)
    try {
      if (d.when === 'now') {
        await call(client.POST('/api/b/{businessId}/notification-schedules/{id}/send-now', { params: { path: { businessId, id: crypto.randomUUID() } }, body: buildInput(d) }))
      } else {
        await call(client.PUT('/api/b/{businessId}/notification-schedules/{id}', { params: { path: { businessId, id: d.id ?? crypto.randomUUID() } }, body: buildInput(d) }))
      }
      onSaved()
    } catch (e) {
      setFailure(e)
    } finally {
      setBusy(false)
    }
  }

  const serverMessage = failure == null ? null : failure instanceof ApiError && failure.code !== 'OFFLINE' ? t(`err.${failure.code}`, { defaultValue: errorText(t, failure) }) : errorText(t, failure)
  const localMessage = tried && error ? t(`draftError.${error}`) : null

  return (
    <Modal open title={initial.id ? t('editor.editTitle') : t('editor.newTitle')} onClose={onClose}>
      <div className="sched-form">
        <div>
          <span className="field-label">{t('editor.templates')}</span>
          <div className="chips">
            {TEMPLATES.map((k) => (
              <button key={k} type="button" className="chip" onClick={() => set({ title: t(`template.${k}.title`), body: t(`template.${k}.body`) })}>
                {t(`template.${k}.title`)}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('editor.title')}>
          <input value={d.title} maxLength={TITLE_MAX} onChange={(e) => set({ title: e.target.value })} />
          <span className={`sched-counter${d.title.length > TITLE_RECOMMENDED ? ' over' : ''}`}>{t('editor.counter', { n: d.title.length, max: TITLE_RECOMMENDED })}</span>
        </Field>
        <Field label={t('editor.body')}>
          <textarea value={d.body} maxLength={BODY_MAX} onChange={(e) => set({ body: e.target.value })} />
          <span className={`sched-counter${d.body.length > BODY_RECOMMENDED ? ' over' : ''}`}>{t('editor.counter', { n: d.body.length, max: BODY_RECOMMENDED })}</span>
        </Field>

        <div>
          <span className="field-label">{t('editor.audience')}</span>
          <div className="chips">
            <button type="button" className={`chip${d.all ? ' on' : ''}`} aria-pressed={d.all} onClick={() => set({ all: !d.all })}>
              {t('audience.all')}
            </button>
            {(['ADMIN', 'CASHIER'] as const).map((r) => (
              <button key={r} type="button" disabled={d.all} className={`chip${!d.all && d.roles.includes(r) ? ' on' : ''}`} aria-pressed={!d.all && d.roles.includes(r)} onClick={() => set({ roles: toggle(d.roles, r) })}>
                {t(`audience.role.${r}`)}
              </button>
            ))}
          </div>
          {!d.all && members.length > 0 && (
            <div className="sched-people" role="group" aria-label={t('audience.people')}>
              {members.map((m) => (
                <label key={m.id} className="sched-check">
                  <input type="checkbox" checked={d.memberIds.includes(m.id ?? '')} onChange={() => set({ memberIds: toggle(d.memberIds, m.id ?? '') })} />
                  <span>
                    {m.displayName} <Tag>{t(`audience.role.${m.role}`, { defaultValue: m.role ?? '' })}</Tag>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label={t('editor.link')}>
          <select value={d.link} onChange={(e) => set({ link: e.target.value })}>
            <option value="">{t('link.none')}</option>
            {LINKS.map((l) => (
              <option key={l} value={l}>
                {t(`link.${l.slice('cuadra://'.length)}`)}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="field-label">{t('editor.when')}</span>
          <div className="chips">
            {WHENS.map((w) => (
              <button key={w} type="button" className={`chip${d.when === w ? ' on' : ''}`} aria-pressed={d.when === w} onClick={() => set({ when: w })}>
                {t(`when.${w}`)}
              </button>
            ))}
          </div>
          {d.when !== 'now' && <p className="muted small">{t('editor.zone', { zone: business.timezone ?? '' })}</p>}
        </div>

        {d.when === 'once' && (
          <div className="two">
            <Field label={t('editor.date')}>
              <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label={t('editor.time')}>
              <input type="time" value={d.time} onChange={(e) => set({ time: e.target.value })} />
            </Field>
          </div>
        )}

        {d.when === 'repeat' && (
          <>
            <div className="chips">
              {REPEATS.map((r) => (
                <button key={r} type="button" className={`chip${d.repeat === r ? ' on' : ''}`} aria-pressed={d.repeat === r} onClick={() => set({ repeat: r })}>
                  {t(`repeat.${r}`)}
                </button>
              ))}
            </div>
            {d.repeat === 'WEEKLY' && (
              <div role="group" aria-label={t('editor.days')}>
                <span className="field-label">{t('editor.days')}</span>
                <div className="chips">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} type="button" className={`chip${d.days.includes(n) ? ' on' : ''}`} aria-pressed={d.days.includes(n)} onClick={() => set({ days: toggle(d.days, n) })}>
                      {t(`weekday.${n}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="two">
              {d.repeat === 'MONTHLY' && (
                <Field label={t('editor.dayOfMonth')}>
                  <input type="number" min={1} max={31} value={d.dayOfMonth} onChange={(e) => set({ dayOfMonth: e.target.value })} />
                </Field>
              )}
              {d.repeat === 'EVERY_N_DAYS' && (
                <Field label={t('editor.everyDays')}>
                  <input type="number" min={1} max={365} value={d.everyDays} onChange={(e) => set({ everyDays: e.target.value })} />
                </Field>
              )}
              <Field label={t('editor.time')}>
                <input type="time" value={d.time} onChange={(e) => set({ time: e.target.value })} />
              </Field>
              <Field label={t('editor.endDate')} hint={t('editor.endHint')}>
                <input type="date" value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              </Field>
            </div>
          </>
        )}

        <div className="sched-preview" aria-label={t('editor.preview')}>
          <span className="muted small">{t('editor.preview')}</span>
          <strong>{d.title || t('editor.previewTitle')}</strong>
          <span>{d.body || t('editor.previewBody')}</span>
        </div>

        {(localMessage || serverMessage) && (
          <p className="notice error" role="alert">
            {serverMessage ?? localMessage}
          </p>
        )}
        <div className="sched-actions-row">
          <Button onClick={onClose}>{t('actions.cancel')}</Button>
          <Button kind="primary" disabled={busy} onClick={() => void submit()}>
            {d.when === 'now' ? t('actions.sendNow') : t('actions.schedule')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
