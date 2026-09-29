import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { cashParts, type DayClose } from './logic'

export type CloseFigures = Pick<
  DayClose,
  'salesCount' | 'salesMinor' | 'byMethod' | 'creditCollected' | 'drawerExpensesMinor' | 'otherExpensesMinor' | 'withdrawalsMinor' | 'depositsMinor' | 'expectedCashMinor' | 'cancelledCount' | 'cancelledMinor'
>

/** Las cifras de una jornada (o de todo el rango): ventas, métodos, abonos, gastos, retiros y el efectivo que debe haber. Nadie abre ni cierra nada. */
export function DayCard({ title, window, figures, muted }: { title: ReactNode; window?: string; figures: CloseFigures; muted?: boolean }) {
  const { t } = useTranslation('cierres')
  const { money } = useFormat()
  const p = cashParts(figures)
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
        <div className="cols">
          <div className="block">
            <div className="head">
              <span>{t('sales.title', { count: figures.salesCount })}</span>
              <span>{money(figures.salesMinor)}</span>
            </div>
            {(figures.byMethod ?? []).map((m) => row(method(m.method ?? ''), money(m.amountMinor), `s-${m.method}`))}
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
        {figures.cancelledCount > 0 && (
          <p>
            <Tag tone="red">{t('cancelled', { count: figures.cancelledCount, amount: money(figures.cancelledMinor) })}</Tag>
          </p>
        )}
      </div>
    </Card>
  )
}
