import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useAuth, useBusiness } from '../../auth/context'
import { Button, Card, ErrorNotice, Field, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { errorText } from '../../lib/errors'
import { NOTIFICATION_TYPES } from './notificationText'
import { validTime } from './schedule'

/** Qué avisos recibe ESTA persona (cada quien elige los suyos) y, para el dueño, las reglas del negocio: silencio, resumen, recordatorios. */
export function Preferences() {
  return (
    <div className="page">
      <Mine />
      <BusinessSettings />
    </div>
  )
}

function Mine() {
  const { t } = useTranslation('avisos')
  const { membership } = useBusiness()
  const businessId = membership.businessId ?? ''
  const prefs = useAsync(() => call(client.GET('/api/b/{businessId}/notification-preferences', { params: { path: { businessId } } })), [businessId])
  const [override, setOverride] = useState<Record<string, boolean>>({})
  const [failure, setFailure] = useState<unknown>(null)
  const value = (type: string) => override[type] ?? (prefs.data as Record<string, boolean> | undefined)?.[type] !== false

  async function toggle(type: string, enabled: boolean) {
    // Cambio inmediato en pantalla; si el servidor no lo acepta, vuelve al valor real.
    setOverride((o) => ({ ...o, [type]: enabled }))
    setFailure(null)
    try {
      await call(client.PUT('/api/b/{businessId}/notification-preferences', { params: { path: { businessId } }, body: { type, enabled } }))
    } catch (e) {
      setOverride((o) => ({ ...o, [type]: !enabled }))
      setFailure(e)
    }
  }

  return (
    <Card title={t('prefs.title')}>
      <p className="muted">{t('prefs.hint')}</p>
      {failure != null && <ErrorNotice error={failure} />}
      {prefs.error && <ErrorNotice error={prefs.error} onRetry={prefs.reload} />}
      {prefs.loading && !prefs.data && <Spinner />}
      {prefs.data &&
        NOTIFICATION_TYPES.map((type) => (
          <label key={type} className="pref-row">
            <span>{t(`prefs.type.${type}`)}</span>
            <input type="checkbox" checked={value(type)} onChange={(e) => void toggle(type, e.target.checked)} />
          </label>
        ))}
    </Card>
  )
}

type Form = { quietStart: string; quietEnd: string; summaryEnabled: boolean; summaryTime: string; reminderOn: boolean; reminderTime: string; staleHours: string }

function BusinessSettings() {
  const { t } = useTranslation('avisos')
  const { canUsePanel } = useAuth()
  const { membership, business } = useBusiness()
  const businessId = membership.businessId ?? ''
  const data = useAsync(() => call(client.GET('/api/b/{businessId}/notification-settings', { params: { path: { businessId } } })), [businessId])
  const [edit, setEdit] = useState<Partial<Form>>({})
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const s = data.data
  const form: Form | null = s
    ? {
        quietStart: (s.quietStart ?? '21:30').slice(0, 5),
        quietEnd: (s.quietEnd ?? '07:00').slice(0, 5),
        summaryEnabled: s.summaryEnabled,
        summaryTime: (s.summaryTime ?? '21:00').slice(0, 5),
        reminderOn: s.shiftReminderTime != null,
        reminderTime: (s.shiftReminderTime ?? '21:00').slice(0, 5),
        staleHours: String(s.staleHours),
        ...edit,
      }
    : null
  const set = <K extends keyof Form>(k: K, v: Form[K]) => (setSaved(false), setEdit((e) => ({ ...e, [k]: v })))
  const stale = Number(form?.staleHours)
  const valid = form != null && validTime(form.quietStart) && validTime(form.quietEnd) && validTime(form.summaryTime) && validTime(form.reminderTime) && Number.isInteger(stale) && stale >= 1 && stale <= 720

  async function save() {
    if (!form || !valid) return
    setSaving(true)
    setFailure(null)
    try {
      await call(
        client.PUT('/api/b/{businessId}/notification-settings', {
          params: { path: { businessId } },
          body: { quietStart: form.quietStart, quietEnd: form.quietEnd, summaryEnabled: form.summaryEnabled, summaryTime: form.summaryTime, shiftReminderTime: form.reminderOn ? form.reminderTime : undefined, staleHours: stale },
        }),
      )
      setEdit({})
      setSaved(true)
      data.reload()
    } catch (e) {
      setFailure(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title={t('biz.title')}>
      <p className="muted">{t('biz.hint', { zone: business.timezone ?? '' })}</p>
      {!canUsePanel && <p className="notice warn">{t('biz.ownerOnly')}</p>}
      {data.error && <ErrorNotice error={data.error} onRetry={data.reload} />}
      {data.loading && !data.data && <Spinner />}
      {form && (
        <div className="sched-form">
          <div className="settings-grid">
            <Field label={t('biz.quietStart')}>
              <input type="time" value={form.quietStart} disabled={!canUsePanel} onChange={(e) => set('quietStart', e.target.value)} />
            </Field>
            <Field label={t('biz.quietEnd')} hint={t('biz.quietHint')}>
              <input type="time" value={form.quietEnd} disabled={!canUsePanel} onChange={(e) => set('quietEnd', e.target.value)} />
            </Field>
          </div>
          <div className="settings-grid">
            <label className="sched-check">
              <input type="checkbox" checked={form.summaryEnabled} disabled={!canUsePanel} onChange={(e) => set('summaryEnabled', e.target.checked)} />
              <span>{t('biz.summary')}</span>
            </label>
            <Field label={t('biz.summaryTime')}>
              <input type="time" value={form.summaryTime} disabled={!canUsePanel || !form.summaryEnabled} onChange={(e) => set('summaryTime', e.target.value)} />
            </Field>
          </div>
          <div className="settings-grid">
            <label className="sched-check">
              <input type="checkbox" checked={form.reminderOn} disabled={!canUsePanel} onChange={(e) => set('reminderOn', e.target.checked)} />
              <span>{t('biz.reminder')}</span>
            </label>
            <Field label={t('biz.reminderTime')}>
              <input type="time" value={form.reminderTime} disabled={!canUsePanel || !form.reminderOn} onChange={(e) => set('reminderTime', e.target.value)} />
            </Field>
          </div>
          <Field label={t('biz.stale')} hint={t('biz.staleHint')}>
            <input type="number" min={1} max={720} value={form.staleHours} disabled={!canUsePanel} onChange={(e) => set('staleHours', e.target.value)} />
          </Field>
          {failure != null && <p className="notice error">{errorText(t, failure)}</p>}
          {!valid && <p className="notice warn">{t('biz.invalid')}</p>}
          {saved && <p className="notice" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>{t('biz.saved')}</p>}
          {canUsePanel && (
            <div className="sched-actions-row">
              <Button kind="primary" disabled={!valid || saving} onClick={() => void save()}>
                {t('actions.save')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
