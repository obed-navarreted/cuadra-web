import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { Card, Tabs } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { Bar } from '../reportes/shared'
import { barPercent, share, showServedToggle, topPeople, type BreakdownRow } from '../reportes/logic'

type Mode = 'charged' | 'served'

/**
 * «Por persona» de Ventas: lo vendido del rango por persona, con una barra fina de su parte del total. Con «Cobro en caja» (o si alguna venta la atendió
 * una persona y la cobró otra) se elige entre quien cobró y quien atendió. Tocar una persona filtra la lista; tocarla otra vez quita el filtro.
 */
export function PeopleCard({ businessId, range, registerCheckout, selected, onSelect, refreshKey }: { businessId: string; range: DateRange; registerCheckout: boolean; selected: string; onSelect: (id: string) => void; refreshKey?: unknown }) {
  const { t } = useTranslation('ventas')
  const { money } = useFormat()
  const [mode, setMode] = useState<Mode>('charged')
  const [showAll, setShowAll] = useState(false)
  const state = useAsync(async () => {
    const q = { from: range.from, to: range.to }
    const get = (by: string) => call(client.GET('/api/b/{businessId}/reports/sales/breakdown', { params: { path: { businessId }, query: { by, ...q } } }))
    const [charged, served] = await Promise.all([get('member'), get('member_served')])
    return { charged: Array.isArray(charged) ? charged : [], served: Array.isArray(served) ? served : [] }
  }, [businessId, range.from, range.to, refreshKey])

  if (!state.data) return null
  const rows: BreakdownRow[] = mode === 'served' ? state.data.served : state.data.charged
  if (rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.totalMinor, 0)
  const max = Math.max(0, ...rows.map((r) => r.totalMinor))
  const { shown, hidden } = topPeople(rows, showAll)
  const toggle = showServedToggle(registerCheckout, state.data.charged, state.data.served)

  return (
    <Card title={t('people.title')}>
      {toggle && (
        <>
          <Tabs
            value={mode}
            onChange={setMode}
            items={[
              { key: 'charged', label: t('people.charged') },
              { key: 'served', label: t('people.served') },
            ]}
          />
          <p className="report-note">{t(mode === 'served' ? 'people.servedHelp' : 'people.chargedHelp')}</p>
        </>
      )}
      <ul className="people-list">
        {shown.map((r) => {
          const on = r.key != null && r.key === selected
          return (
            <li key={r.key ?? r.label ?? ''}>
              <button type="button" className={`people-row${on ? ' on' : ''}`} aria-pressed={on} disabled={r.key == null} onClick={() => r.key != null && onSelect(on ? '' : r.key)}>
                <span className="people-name">{r.label ?? '—'}</span>
                <span className="people-amount">{money(r.totalMinor)}</span>
                <span className="people-count">{t('people.sales', { count: r.count, percent: share(r.totalMinor, total) })}</span>
                <Bar percent={barPercent(r.totalMinor, max)} label={`${share(r.totalMinor, total)} %`} />
              </button>
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" className="link people-more" onClick={() => setShowAll(true)}>
          {t('people.showAll', { count: rows.length })}
        </button>
      )}
      {showAll && rows.length > 6 && (
        <button type="button" className="link people-more" onClick={() => setShowAll(false)}>
          {t('people.showLess')}
        </button>
      )}
    </Card>
  )
}
