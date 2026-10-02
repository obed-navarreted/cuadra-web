import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { cashAdjustments, cashParts, type DayClose } from './logic'

export type CloseFigures = Pick<
  DayClose,
  'salesCount' | 'salesMinor' | 'byMethod' | 'creditCollected' | 'drawerExpensesMinor' | 'otherExpensesMinor' | 'withdrawalsMinor' | 'depositsMinor' | 'expectedCashMinor' | 'cancelledCount' | 'cancelledMinor'
> &
  Partial<Pick<DayClose, 'returnsCount' | 'returnsMinor' | 'cashRefundsMinor' | 'priorCancelledCount' | 'priorCancelledMinor' | 'priorCancelledCashMinor' | 'netSalesMinor' | 'laterVoids' | 'pendingCheckoutCount' | 'pendingCheckoutMinor' | 'promotionDiscountMinor'>>

/** Las cifras de una jornada (o de todo el rango): ventas, métodos, abonos, gastos, retiros y el efectivo que debe haber. Nadie abre ni cierra nada. */
export function DayCard({ title, window, figures, muted }: { title: ReactNode; window?: string; figures: CloseFigures; muted?: boolean }) {
  const { t } = useTranslation('cierres')
  const { money } = useFormat()
  const p = cashParts(figures)
  const a = cashAdjustments(figures)
  const returnsCount = figures.returnsCount ?? 0
  const priorCount = figures.priorCancelledCount ?? 0
  const adjusted = returnsCount > 0 || priorCount > 0
  const hasAdjustments = a.cashRefunds !== 0 || a.priorCancelledCash !== 0 || a.later !== 0
  const signed = (n: number) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`)
  const row = (label: string, value: string, key?: string) => (
    <div key={key ?? label}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
  const method = (m: string) => t(`method.${m}`, { defaultValue: m })
  return (
    <Card title={title}>
      <div className={`day-close${muted ? ' empty-day' : ''}`}>
        {window && <p className="window">{window}</p>}
        {/* Cobro en caja (ADR 0015): cuentas enviadas a caja que seguían sin cobrar al terminar la jornada; no son ventas hasta cobrarse. */}
        {(figures.pendingCheckoutCount ?? 0) > 0 && (
          <p className="notice warn" role="status">
            {t('pendingCheckout', { count: figures.pendingCheckoutCount ?? 0, amount: money(figures.pendingCheckoutMinor ?? 0) })}
          </p>
        )}
        <div className="cols">
          <div className="block">
            <div className="head">
              <span>{t('sales.title', { count: figures.salesCount })}</span>
              <span>{money(figures.salesMinor)}</span>
            </div>
            {(figures.byMethod ?? []).map((m) => row(method(m.method ?? ''), money(m.amountMinor), `s-${m.method}`))}
            {(figures.promotionDiscountMinor ?? 0) > 0 && row(t('promotions.line'), `−${money(figures.promotionDiscountMinor ?? 0)}`, 'promotions')}
            {returnsCount > 0 && row(t('returns.line', { count: returnsCount }), `−${money(figures.returnsMinor ?? 0)}`, 'returns')}
            {priorCount > 0 && row(t('priorCancelled.line', { count: priorCount }), `−${money(figures.priorCancelledMinor ?? 0)}`, 'prior')}
            {adjusted && (
              <div className="head" key="net">
                <span>{t('net.label')}</span>
                <span>{money(figures.netSalesMinor ?? figures.salesMinor)}</span>
              </div>
            )}
          </div>
          <div className="block">
            <div className="head">
              <span>{t('collected.title')}</span>
            </div>
            {(figures.creditCollected ?? []).length === 0 ? <div className="muted"><span>{t('collected.none')}</span></div> : (figures.creditCollected ?? []).map((m) => row(method(m.method ?? ''), money(m.amountMinor), `c-${m.method}`))}
          </div>
          <div className="block">
            <div className="head">
              <span>{t('money.title')}</span>
            </div>
            {row(t('money.drawerExpenses'), money(figures.drawerExpensesMinor))}
            {row(t('money.otherExpenses'), money(figures.otherExpensesMinor))}
            {row(t('money.withdrawals'), money(figures.withdrawalsMinor))}
            {row(t('money.deposits'), money(figures.depositsMinor))}
            {a.cashRefunds > 0 && row(t('money.cashRefunds'), money(a.cashRefunds), 'cash-refunds')}
            {(figures.laterVoids ?? []).map((v) => row(t(`laterVoid.${v.kind}`, { count: v.count }), v.cashEffectMinor === 0 ? money(v.amountMinor) : signed(v.cashEffectMinor), `lv-${v.kind}`))}
          </div>
        </div>
        <div className="expected">
          <span>{t('expected.label')}</span>
          <strong>{money(figures.expectedCashMinor)}</strong>
        </div>
        <p className="formula">
          {t('expected.formula', {
            cashSales: money(p.cashSales),
            cashCollected: money(p.cashCollected),
            deposits: money(p.deposits),
            drawerExpenses: money(p.drawerExpenses),
            withdrawals: money(p.withdrawals),
            total: money(figures.expectedCashMinor),
          })}
        </p>
        {hasAdjustments && (
          <p className="formula">
            {t('expected.adjustments', { cashRefunds: money(a.cashRefunds), priorCash: money(a.priorCancelledCash), later: signed(a.later) })}
          </p>
        )}
        {figures.cancelledCount > 0 && (
          <p>
            <Tag tone="red">{t('cancelled', { count: figures.cancelledCount, amount: money(figures.cancelledMinor) })}</Tag>
          </p>
        )}
      </div>
    </Card>
  )
}
