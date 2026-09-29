import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { EmptyState, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { loadProductHistory } from './api'
import { describeEntry } from './logic'

/** Quién cambió qué en un producto y cuándo, del más reciente al más antiguo. */
export function ProductHistory({ productId, categoryName }: { productId: string; categoryName: (id: string) => string | undefined }) {
  const { t } = useTranslation('inventario')
  const { t: tTeam } = useTranslation('equipo')
  const { business } = useBusiness()
  const fmt = useFormat()
  const history = useAsync(() => loadProductHistory(business.id, productId), [business.id, productId])

  if (history.error) return <ErrorNotice error={history.error} onRetry={history.reload} />
  if (history.loading && !history.data) return <Spinner />
  const entries = history.data ?? []
  if (entries.length === 0) return <EmptyState>{t('history.empty')}</EmptyState>
  const deps = { t: t as (k: string, o?: Record<string, unknown>) => string, money: fmt.money, quantity: fmt.quantity, categoryName }

  return (
    <ol className="inv-history">
      {entries.map((e) => (
        <li key={e.id} className="inv-history-item">
          <div className="inv-history-head">
            <strong>{e.actorName || t('history.someone')}</strong>
            {e.actorRole && <Tag tone={e.actorRole === 'OWNER' ? 'green' : e.actorRole === 'ADMIN' ? 'orange' : 'neutral'}>{tTeam(`role.${e.actorRole}`, { defaultValue: e.actorRole })}</Tag>}
            {e.at && <span className="muted small">{fmt.dateTime(e.at)}</span>}
          </div>
          <ul className="inv-history-lines">
            {describeEntry(e, deps).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
