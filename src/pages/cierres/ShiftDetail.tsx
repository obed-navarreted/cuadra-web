import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, ErrorNotice, Spinner, Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { OutcomeTag } from './OutcomeTag'
import type { Shift } from './logic'

/**
 * Detalle de un turno con el desglose de lo que movió la caja. "Debe haber" ahora puede ser distinto a lo que se firmó al cerrar cuando llegaron
 * operaciones tardías (de un teléfono que estaba sin conexión): se muestran los dos.
 */
export function ShiftDetail({ shift, loading, error, onRetry, onClose, onReopen }: { shift: Shift | undefined; loading: boolean; error: unknown; onRetry: () => void; onClose: () => void; onReopen: (s: Shift) => void }) {
  const { t } = useTranslation('cierres')
  const { money, dateTime } = useFormat()
  const { isOwner } = useAuth()
  const b = shift?.breakdown
  return (
    <Modal open title={t('detail.title')} onClose={onClose}>
      {error != null && <ErrorNotice error={error} onRetry={onRetry} />}
      {!shift && !error && loading && <Spinner />}
      {shift && (
        <div className="shift-detail">
          <div className="flags">
            {shift.status === 'CLOSED' ? <Tag>{t('status.CLOSED')}</Tag> : <Tag tone="green">{t('status.OPEN')}</Tag>}
            <OutcomeTag differenceMinor={shift.differenceMinor} />
            {shift.forcedReason && <Tag tone="orange">{t('flag.forced')}</Tag>}
            {shift.lateOps > 0 && <Tag tone="orange">{t('flag.late', { count: shift.lateOps })}</Tag>}
            {shift.reopenedCount > 0 && <Tag>{t('flag.reopened', { count: shift.reopenedCount })}</Tag>}
          </div>
          <dl>
            <dt>{t('detail.register')}</dt>
            <dd>{shift.registerName ?? '—'}</dd>
            <dt>{t('detail.opened')}</dt>
            <dd>{shift.openedAt ? `${dateTime(shift.openedAt)} · ${shift.openedBy?.name ?? '—'}` : '—'}</dd>
            {shift.closedAt && (
              <>
                <dt>{t('detail.closed')}</dt>
                <dd>{`${dateTime(shift.closedAt)} · ${shift.closedBy?.name ?? '—'}`}</dd>
              </>
            )}
            {shift.note && (
              <>
                <dt>{t('detail.note')}</dt>
                <dd>{shift.note}</dd>
              </>
            )}
            {shift.forcedReason && (
              <>
                <dt>{t('detail.forcedReason')}</dt>
                <dd>{shift.forcedReason}</dd>
              </>
            )}
          </dl>
          {b && (
            <div className="breakdown" aria-label={t('detail.breakdown')}>
              <div>
                <span>{t('detail.float')}</span>
                <span>{money(shift.openingFloatMinor)}</span>
              </div>
              <div>
                <span>{t('detail.cashSales', { count: b.cashSalesCount })}</span>
                <span>+{money(b.cashSalesMinor)}</span>
              </div>
              <div>
                <span>{t('detail.creditPayments')}</span>
                <span>+{money(b.creditPaymentsCashMinor)}</span>
              </div>
              <div>
                <span>{t('detail.deposits')}</span>
                <span>+{money(b.depositsMinor)}</span>
              </div>
              <div className="minus">
                <span>{t('detail.cashExpenses')}</span>
                <span>−{money(b.expensesCashMinor)}</span>
              </div>
              <div className="minus">
                <span>{t('detail.withdrawals')}</span>
                <span>−{money(b.withdrawalsMinor)}</span>
              </div>
              <div className="sum">
                <span>{shift.status === 'CLOSED' ? t('detail.expectedNow') : t('detail.expected')}</span>
                <span>{money(b.expectedNowMinor)}</span>
              </div>
            </div>
          )}
          {shift.status === 'CLOSED' && (
            <div className="breakdown">
              {shift.expectedAtCloseMinor != null && (
                <div>
                  <span>{t('detail.expectedAtClose')}</span>
                  <span>{money(shift.expectedAtCloseMinor)}</span>
                </div>
              )}
              {shift.countedMinor != null && (
                <div>
                  <span>{t('detail.counted')}</span>
                  <span>{money(shift.countedMinor)}</span>
                </div>
              )}
            </div>
          )}
          {b && (
            <div className="breakdown">
              <div>
                <span>{t('detail.transfer')}</span>
                <span>{money(b.transferMinor)}</span>
              </div>
              <div>
                <span>{t('detail.card')}</span>
                <span>{money(b.cardMinor)}</span>
              </div>
              <div>
                <span>{t('detail.other')}</span>
                <span>{money(b.otherMinor)}</span>
              </div>
              <div>
                <span>{t('detail.creditNew')}</span>
                <span>{money(b.creditNewMinor)}</span>
              </div>
              <div>
                <span>{t('detail.cancelled')}</span>
                <span>{b.cancelledCount}</span>
              </div>
              <span className="muted small">{t('detail.otherHint')}</span>
            </div>
          )}
          <div className="row">
            <Button onClick={onClose}>{t('detail.close')}</Button>
            {isOwner && shift.status === 'CLOSED' && <Button kind="danger" onClick={() => onReopen(shift)}>{t('detail.reopen')}</Button>}
          </div>
        </div>
      )}
    </Modal>
  )
}
