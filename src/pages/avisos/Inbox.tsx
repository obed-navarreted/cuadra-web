import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Button, EmptyState, ErrorNotice, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { notificationText, panelRoute, type NotificationView } from './notificationText'

const STEP = 20
const MAX = 100

/** Bandeja: todo lo que el sistema avisó a esta persona. Tocar uno lo marca como leído. */
export function Inbox() {
  const { t } = useTranslation('avisos')
  const { membership } = useBusiness()
  const businessId = membership.businessId ?? ''
  const f = useFormat()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [size, setSize] = useState(STEP)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const list = useAsync(() => call(client.GET('/api/b/{businessId}/notifications', { params: { path: { businessId }, query: { unreadOnly, page: 0, size } } })), [businessId, unreadOnly, size])

  const items = (list.data?.items ?? []) as NotificationView[]
  const unread = items.filter((n) => !n.readAt)

  async function markRead(ids: string[]) {
    setBusy(true)
    setFailure(null)
    try {
      await Promise.all(ids.map((id) => call(client.POST('/api/b/{businessId}/notifications/{id}/read', { params: { path: { businessId, id } } }))))
      list.reload()
    } catch (e) {
      setFailure(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="row">
        <div className="chips grow">
          <button type="button" className={`chip${!unreadOnly ? ' on' : ''}`} onClick={() => setUnreadOnly(false)}>
            {t('inbox.all')}
          </button>
          <button type="button" className={`chip${unreadOnly ? ' on' : ''}`} onClick={() => setUnreadOnly(true)}>
            {t('inbox.unread')}
          </button>
        </div>
        {unread.length > 0 && (
          <Button small disabled={busy} onClick={() => void markRead(unread.map((n) => n.id))}>
            {t('inbox.markAll')}
          </Button>
        )}
      </div>
      {failure != null && <ErrorNotice error={failure} />}
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Spinner />}
      {list.data && items.length === 0 && <EmptyState>{unreadOnly ? t('inbox.emptyUnread') : t('inbox.empty')}</EmptyState>}
      <div className="avisos-list">
        {items.map((n) => {
          const { title, body } = notificationText(t, n, f)
          const route = panelRoute(n.deepLink)
          const isUnread = !n.readAt
          return (
            <div key={n.id} className={`avisos-item${isUnread ? ' unread' : ''}`}>
              <span className="avisos-dot" aria-hidden="true" />
              <button type="button" className="avisos-text" disabled={!isUnread || busy} onClick={() => void markRead([n.id])}>
                <span className="avisos-title">{title}</span>
                <span className="avisos-body">{body}</span>
                <span className="avisos-meta">
                  {n.createdAt ? f.dateTime(n.createdAt) : ''}
                  {isUnread ? ` · ${t('inbox.new')}` : ''}
                </span>
              </button>
              {route && (
                <Link className="avisos-open" to={route} onClick={() => isUnread && void markRead([n.id])}>
                  {t('inbox.open')}
                </Link>
              )}
            </div>
          )
        })}
      </div>
      {list.data && !list.data.last && size < MAX && (
        <Button onClick={() => setSize((s) => Math.min(MAX, s + STEP))} disabled={list.loading}>
          {t('inbox.more')}
        </Button>
      )}
    </div>
  )
}
