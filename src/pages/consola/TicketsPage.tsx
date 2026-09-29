import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Pager } from '../../components/Pager'
import { Card, EmptyState, ErrorNotice, Field, Page, Spinner, Tag } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { listTickets, setTicketStatus, type TicketRow } from './api'
import { useConsoleFormat } from './format'

const STATUSES = ['NEW', 'ANSWERED', 'CLOSED'] as const
const SIZE = 25

function TicketCard({ ticket, onChanged }: { ticket: TicketRow; onChanged: () => void }) {
  const { t } = useTranslation('consola')
  const { dateTime, language } = useConsoleFormat()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function change(status: string) {
    setBusy(true)
    setError(null)
    try {
      await setTicketStatus(ticket.id, status)
      onChanged()
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  const tone = ticket.status === 'NEW' ? 'orange' : ticket.status === 'CLOSED' ? 'neutral' : 'green'
  return (
    <Card
      title={
        <>
          {ticket.category ?? t('tickets.noCategory')} <Tag tone={tone}>{t(`ticketStatus.${ticket.status}`, { defaultValue: ticket.status ?? '' })}</Tag>
        </>
      }
      actions={
        <Field label={t('tickets.changeStatus')}>
          <select value={ticket.status ?? ''} disabled={busy} onChange={(e) => void change(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`ticketStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      }
    >
      <p className="muted small">
        {ticket.businessId ? <Link to={`/console/negocios/${ticket.businessId}`}>{ticket.businessName}</Link> : t('tickets.noBusiness')} · {dateTime(ticket.createdAt)} · {language(ticket.locale)}
      </p>
      <p className="ticket-msg">{ticket.message}</p>
      {(ticket.replyToEmail || ticket.replyToPhone) && (
        <p className="small">
          <strong>{t('tickets.replyTo')}</strong> {[ticket.replyToEmail, ticket.replyToPhone].filter(Boolean).join(' · ')}
        </p>
      )}
      {ticket.diagnostics && (
        <details>
          <summary>{t('tickets.diagnostics')}</summary>
          <pre className="diag">{ticket.diagnostics}</pre>
        </details>
      )}
      {error !== null && <ErrorNotice error={error} />}
    </Card>
  )
}

export function TicketsPage() {
  const { t } = useTranslation('consola')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const list = useAsync(() => listTickets(status || undefined, page, SIZE), [status, page])
  return (
    <Page title={t('nav.tickets')} subtitle={t('tickets.subtitle')}>
      <div className="chips" role="group" aria-label={t('tickets.filter')}>
        {['', ...STATUSES].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`chip${status === s ? ' on' : ''}`}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s)
              setPage(0)
            }}
          >
            {s ? t(`ticketStatus.${s}`) : t('all')}
          </button>
        ))}
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Spinner />}
      {list.data && ((list.data.items ?? []).length === 0 ? <EmptyState>{t('tickets.empty')}</EmptyState> : (list.data.items ?? []).map((tk) => <TicketCard key={tk.id} ticket={tk} onChanged={list.reload} />))}
      {list.data && <Pager page={page} size={SIZE} total={list.data.total} onChange={setPage} />}
    </Page>
  )
}
