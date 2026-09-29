import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useBusiness } from '../../auth/context'
import { RangePicker } from '../../components/RangePicker'
import { Page, Tabs } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { ClosingsReport } from './ClosingsReport'
import { ExpensesReport } from './ExpensesReport'
import { InventoryReport } from './InventoryReport'
import { ProductsReport } from './ProductsReport'
import { ProfitReport } from './ProfitReport'
import { ReceivablesReport } from './ReceivablesReport'
import { SalesReport } from './SalesReport'
import './reportes.css'

const TABS = ['sales', 'profit', 'products', 'receivables', 'expenses', 'closings', 'inventory'] as const
type Tab = (typeof TABS)[number]
/** Estos dos muestran cómo está el negocio hoy: no dependen del rango de fechas. */
const NOT_RANGED: Tab[] = ['receivables', 'inventory']

/** Reportes (PLAN.md 5.9). La pestaña va en la dirección (`?tab=`), así el Resumen puede enlazar a una y recargar no la pierde. */
export default function ReportesPage() {
  const { t } = useTranslation('reportes')
  const { business } = useBusiness()
  const { day, presets } = useFormat()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState<DateRange>(() => presets().last7)
  const requested = params.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'sales'
  const ranged = !NOT_RANGED.includes(tab)

  return (
    <Page title={t('title')} subtitle={ranged ? t('subtitle', { from: day(range.from), to: day(range.to) }) : t('notRanged')}>
      <Tabs value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} items={TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))} />
      {ranged && <RangePicker value={range} onChange={setRange} />}
      {tab === 'sales' && <SalesReport businessId={business.id} range={range} />}
      {tab === 'profit' && <ProfitReport businessId={business.id} range={range} />}
      {tab === 'products' && <ProductsReport businessId={business.id} range={range} />}
      {tab === 'receivables' && <ReceivablesReport businessId={business.id} />}
      {tab === 'expenses' && <ExpensesReport businessId={business.id} range={range} />}
      {tab === 'closings' && <ClosingsReport businessId={business.id} range={range} />}
      {tab === 'inventory' && <InventoryReport businessId={business.id} />}
    </Page>
  )
}
