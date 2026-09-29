import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorNotice, Field } from '../../components/ui'
import { announcementReach, createAnnouncement } from './api'
import { useConsoleFormat } from './format'
import {
  AUDIENCES,
  BODY_MAX,
  EMPTY_ANNOUNCEMENT,
  TITLE_MAX,
  buildAnnouncementInput,
  buildSegment,
  segmentIsEmpty,
  validateAnnouncement,
  type AnnouncementForm as Form,
  type AnnouncementProblem,
} from './lib'

/** Crear un anuncio: a quién llega (audiencia y segmento), franja opcional y envío ahora o programado. Avisa de los errores antes de llamar a la API. */
export function AnnouncementForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation('consola')
  const { number } = useConsoleFormat()
  const [f, setF] = useState<Form>(EMPTY_ANNOUNCEMENT)
  const [problems, setProblems] = useState<AnnouncementProblem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [reach, setReach] = useState<{ businesses: number; people: number } | null>(null)
  const [reachBusy, setReachBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const segment = buildSegment(f)
  const hasSegment = !segmentIsEmpty(segment)

  function set(patch: Partial<Form>) {
    setF((cur) => {
      const next = { ...cur, ...patch }
      // La franja es para todos: con segmento no se puede.
      if (!segmentIsEmpty(buildSegment(next))) next.banner = false
      return next
    })
    setReach(null)
    setSent(false)
    if (problems.length) setProblems([])
  }

  async function preview() {
    setReachBusy(true)
    setError(null)
    try {
      setReach(await announcementReach(segment, f.audience))
    } catch (e) {
      setError(e)
    }
    setReachBusy(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateAnnouncement(f, Date.now())
    setProblems(found)
    if (found.length) return
    setBusy(true)
    setError(null)
    try {
      await createAnnouncement(buildAnnouncementInput(f))
      setF(EMPTY_ANNOUNCEMENT)
      setReach(null)
      setSent(true)
      onCreated()
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  const bad = (p: AnnouncementProblem) => problems.includes(p)
  return (
    <Card title={t('announcements.new')}>
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t('announcements.title')} hint={`${f.title.length}/${TITLE_MAX}`}>
          <input value={f.title} aria-invalid={bad('titleRequired') || bad('titleTooLong')} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={t('announcements.body')} hint={`${f.body.length}/${BODY_MAX}`}>
          <textarea value={f.body} aria-invalid={bad('bodyRequired') || bad('bodyTooLong')} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        <Field label={t('announcements.deepLink')} hint={t('announcements.deepLinkHint')}>
          <input value={f.deepLink} onChange={(e) => set({ deepLink: e.target.value })} />
        </Field>
        <Field label={t('announcements.audience')}>
          <select value={f.audience} onChange={(e) => set({ audience: e.target.value as Form['audience'] })}>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {t(`audience.${a}`)}
              </option>
            ))}
          </select>
        </Field>

        <fieldset className="segment">
          <legend>{t('announcements.segment')}</legend>
          <p className="muted small">{t('announcements.segmentHint')}</p>
          <Field label={t('announcements.countries')} hint={t('announcements.countriesHint')}>
            <input value={f.countries} onChange={(e) => set({ countries: e.target.value })} />
          </Field>
          <Field label={t('announcements.plans')} hint={t('announcements.plansHint')}>
            <input value={f.plans} onChange={(e) => set({ plans: e.target.value })} />
          </Field>
          <Field label={t('announcements.appVersions')} hint={t('announcements.appVersionsHint')}>
            <input value={f.appVersions} onChange={(e) => set({ appVersions: e.target.value })} />
          </Field>
          <Field label={t('announcements.businessIds')} hint={t('announcements.businessIdsHint')}>
            <input value={f.businessIds} aria-invalid={bad('businessIds')} onChange={(e) => set({ businessIds: e.target.value })} />
          </Field>
        </fieldset>

        <fieldset className="segment">
          <legend>{t('announcements.bannerLegend')}</legend>
          <label className="flag">
            <input type="checkbox" checked={f.banner} disabled={hasSegment} onChange={(e) => set({ banner: e.target.checked })} />
            <span>
              <strong>{t('announcements.banner')}</strong>
              <span className="muted small"> {hasSegment ? t('announcements.bannerDisabled') : t('announcements.bannerHint')}</span>
            </span>
          </label>
          <Field label={t('announcements.bannerUntil')} hint={t('announcements.bannerUntilHint')}>
            <input type="datetime-local" value={f.bannerUntil} disabled={!f.banner} aria-invalid={bad('bannerUntilPast')} onChange={(e) => set({ bannerUntil: e.target.value })} />
          </Field>
        </fieldset>

        <fieldset className="segment">
          <legend>{t('announcements.when')}</legend>
          <div className="chips">
            <label className="flag">
              <input type="radio" name="when" checked={f.mode === 'now'} onChange={() => set({ mode: 'now' })} />
              <span>{t('announcements.sendNow')}</span>
            </label>
            <label className="flag">
              <input type="radio" name="when" checked={f.mode === 'schedule'} onChange={() => set({ mode: 'schedule' })} />
              <span>{t('announcements.schedule')}</span>
            </label>
          </div>
          {f.mode === 'schedule' && (
            <Field label={t('announcements.scheduledAt')}>
              <input type="datetime-local" value={f.scheduledAt} aria-invalid={bad('scheduleRequired') || bad('schedulePast')} onChange={(e) => set({ scheduledAt: e.target.value })} />
            </Field>
          )}
        </fieldset>

        {problems.length > 0 && (
          <div className="notice error" role="alert">
            <ul className="plain grow">
              {problems.map((p) => (
                <li key={p}>{t(`announcements.problem.${p}`, { title: TITLE_MAX, body: BODY_MAX })}</li>
              ))}
            </ul>
          </div>
        )}
        {error !== null && <ErrorNotice error={error} />}
        {reach && (
          <p className="notice warn" role="status">
            {t('announcements.reach', { businesses: number(reach.businesses), people: number(reach.people) })}
          </p>
        )}
        {sent && (
          <p className="notice" role="status">
            {t('announcements.created')}
          </p>
        )}
        <div className="row">
          <Button kind="primary" type="submit" disabled={busy}>
            {f.mode === 'schedule' ? t('announcements.submitSchedule') : t('announcements.submitNow')}
          </Button>
          <Button disabled={reachBusy} onClick={() => void preview()}>
            {t('announcements.previewReach')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
