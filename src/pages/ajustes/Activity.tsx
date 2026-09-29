import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Pager } from '../../components/Pager'
import { Card, EmptyState, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { actionKey, isPlatformAction, splitReason } from './activity'

const SIZE = 30

/** Registro de actividad del negocio (solo dueño). Lo que hizo la plataforma (soporte que miró el negocio, cambios de plan…) se destaca con su motivo. */
export function Activity() {
  const { t } = useTranslation('ajustes')
  const { business } = useBusiness()
  const { dateTime } = useFormat()
  const [page, setPage] = useState(0)
  const list = useAsync(() => call(client.GET('/api/b/{businessId}/activity', { params: { path: { businessId: business.id }, query: { page, size: SIZE } } })), [business.id, page])
  const items = list.data?.items ?? []

  return (
    <Card title={t('activity.title')}>
      <p className="muted small">{t('activity.subtitle')}</p>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Spinner />}
      {list.data && items.length === 0 && <EmptyState>{t('activity.empty')}</EmptyState>}
      <ul className="aj-activity">
        {items.map((e) => {
          const platform = e.byPlatform || isPlatformAction(e.action)
          const key = actionKey(e.action)
          const { note, reason } = splitReason(e.detail)
          return (
            <li key={e.id} className={platform ? 'platform' : undefined}>
              <div className="aj-act-top">
                <strong>{key ? t(key) : platform ? t('activity.platformNoticeGeneric') : (e.action ?? '')}</strong>
                {platform && <Tag tone="orange">{t('activity.byPlatform')}</Tag>}
              </div>
              {(note || (!key && !platform && e.detail)) && <span className="aj-act-detail">{note ?? e.detail}</span>}
              {reason && (
                <span className="aj-act-detail">
                  {t('activity.reason')}: {reason}
                </span>
              )}
              <span className="muted small">
                {e.at ? dateTime(e.at) : ''}
                {!platform && ` · ${e.actorName ? t('activity.by', { name: e.actorName }) : t('activity.system')}`}
              </span>
            </li>
          )
        })}
      </ul>
      {list.data && <Pager page={page} size={SIZE} total={list.data.total ?? 0} onChange={setPage} />}
    </Card>
  )
}
