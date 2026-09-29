import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { Button, Card, ErrorNotice, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { Bar } from './shared'
import { coverageIncomplete, plainAmount, saveText, toCsv } from './logic'

/** Ganancia estimada con su fórmula y desglose. Los mismos números que el Resumen (misma fuente en el servidor). */
export function ProfitReport({ businessId, range }: { businessId: string; range: DateRange }) {
  const { t } = useTranslation('reportes')
  const { money, currency } = useFormat()
  const state = useAsync(() => call(client.GET('/api/b/{businessId}/reports/profit', { params: { path: { businessId }, query: { from: range.from, to: range.to } } })), [businessId, range.from, range.to])

  if (state.error) return <ErrorNotice error={state.error} onRetry={state.reload} />
  if (!state.data) return <Spinner />
  const p = state.data

  // No hay CSV de esta hoja en el servidor: se arma aquí con los mismos números que se ven.
  const download = () =>
    saveText(
      `ganancia-${range.from}_${range.to}.csv`,
      toCsv(
        [t('profit.csvConcept'), t('profit.csvAmount')],
        [
          [t('profit.sales'), plainAmount(p.salesMinor, currency)],
          [t('profit.cost'), plainAmount(-p.costOfGoodsMinor, currency)],
          [t('profit.expenses'), plainAmount(-p.operatingExpensesMinor, currency)],
          [t('profit.profit'), plainAmount(p.estimatedProfitMinor, currency)],
          [t('profit.excluded'), plainAmount(p.purchasesExcludedMinor, currency)],
          [t('profit.coverage') + ' (%)', p.costCoveragePercent],
        ],
      ),
    )

  return (
    <div className="report">
      <Card title={t('profit.explainTitle')} actions={<Button small onClick={download}>{t('csv.download')}</Button>}>
        <p className="formula">{t('profit.formula')}</p>
        <p className="report-note">{t('profit.explain')}</p>
      </Card>
      <Card>
        <div className="money-line">
          <span>{t('profit.sales')}</span>
          <span className="v">{money(p.salesMinor)}</span>
        </div>
        <div className="money-line">
          <span>− {t('profit.cost')}</span>
          <span className="v">{money(p.costOfGoodsMinor)}</span>
        </div>
        <div className="money-line">
          <span>− {t('profit.expenses')}</span>
          <span className="v">{money(p.operatingExpensesMinor)}</span>
        </div>
        <div className="money-line total">
          <span>= {t('profit.profit')}</span>
          <span className={`v ${p.estimatedProfitMinor >= 0 ? 'pos' : 'neg'}`}>{money(p.estimatedProfitMinor)}</span>
        </div>
      </Card>
      <div className="grid-cards">
        <Card title={t('profit.excluded')}>
          <strong>{money(p.purchasesExcludedMinor)}</strong>
          <p className="report-note">{t('profit.excludedHint')}</p>
        </Card>
        <Card title={t('profit.coverage')} tone={coverageIncomplete(p.costCoveragePercent) ? 'orange' : 'green'}>
          <strong>{p.costCoveragePercent} %</strong>
          <Bar percent={p.costCoveragePercent} tone={coverageIncomplete(p.costCoveragePercent) ? 'orange' : undefined} label={`${p.costCoveragePercent} %`} />
          <p className="report-note">{t('profit.coverageHint')}</p>
        </Card>
      </div>
    </div>
  )
}
