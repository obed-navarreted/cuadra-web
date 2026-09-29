import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import { Button, Card, EmptyState, ErrorNotice, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { cancelAnnouncement, endBanner, listAnnouncements, type Announcement } from './api'
import { AnnouncementForm } from './AnnouncementForm'
import { useConsoleFormat } from './format'
import { bannerIsLive } from './lib'

function segmentSummary(a: Announcement): string[] {
  const s = a.segment
  const out: string[] = []
  if (s?.countries?.length) out.push(`${s.countries.join(', ')}`)
  if (s?.plans?.length) out.push(s.plans.join(', '))
  if (s?.appVersions?.length) out.push(s.appVersions.join(', '))
  if (s?.businessIds?.length) out.push(`${s.businessIds.length} ids`)
  return out
}

function AnnouncementCard({ a, onChanged }: { a: Announcement; onChanged: () => void }) {
  const { t } = useTranslation('consola')
  const { dateTime, number } = useConsoleFormat()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [now] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setConfirmCancel(false)
      onChanged()
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  const tone = a.state === 'SENT' ? 'green' : a.state === 'SCHEDULED' ? 'orange' : 'neutral'
  const seg = segmentSummary(a)
  return (
    <Card
      title={
        <>
          {a.title} <Tag tone={tone}>{t(`announcementState.${a.state}`, { defaultValue: a.state ?? '' })}</Tag>
        </>
      }
    >
      <p className="ticket-msg">{a.body}</p>
      <p className="muted small">
        {t(`audience.${a.audience}`, { defaultValue: a.audience ?? '' })} · {seg.length ? seg.join(' · ') : t('announcements.everyone')}
        {a.deepLink ? ` · ${a.deepLink}` : ''}
      </p>
      <p className="muted small">
        {a.state === 'SENT' && t('announcements.sentAt', { at: dateTime(a.sentAt), people: number(a.recipients) })}
        {a.state === 'SCHEDULED' && t('announcements.scheduledFor', { at: dateTime(a.scheduledAt) })}
        {a.state === 'CANCELLED' && t('announcements.cancelledAt', { at: dateTime(a.cancelledAt) })}
        {a.banner && ` · ${a.bannerUntil ? t('announcements.bannerUntilShort', { at: dateTime(a.bannerUntil) }) : t('announcements.bannerOpen')}`}
      </p>
      <div className="row">
        {a.state === 'SCHEDULED' && <Button small onClick={() => setConfirmCancel(true)}>{t('announcements.cancel')}</Button>}
        {bannerIsLive(a, now) && (
          <Button small disabled={busy} onClick={() => void run(() => endBanner(a.id))}>
            {t('announcements.endBanner')}
          </Button>
        )}
      </div>
      {error !== null && <ErrorNotice error={error} />}
      <Modal open={confirmCancel} title={t('announcements.cancelTitle')} onClose={() => setConfirmCancel(false)}>
        <p className="muted">{t('announcements.cancelBody', { title: a.title })}</p>
        <div className="row">
          <Button onClick={() => setConfirmCancel(false)}>{t('announcements.keep')}</Button>
          <Button kind="danger" disabled={busy} onClick={() => void run(() => cancelAnnouncement(a.id))}>
            {t('announcements.cancel')}
          </Button>
        </div>
        {error !== null && <ErrorNotice error={error} />}
      </Modal>
    </Card>
  )
}

export function AnnouncementsPage() {
  const { t } = useTranslation('consola')
  const list = useAsync(listAnnouncements, [])
  return (
    <Page title={t('nav.announcements')} subtitle={t('announcements.subtitle')}>
      <AnnouncementForm onCreated={list.reload} />
      <h2>{t('announcements.history')}</h2>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Spinner />}
      {list.data && (list.data.length === 0 ? <EmptyState>{t('announcements.empty')}</EmptyState> : list.data.map((a) => <AnnouncementCard key={a.id} a={a} onChanged={list.reload} />))}
    </Page>
  )
}
