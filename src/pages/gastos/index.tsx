import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { RangePicker } from '../../components/RangePicker'
import { ErrorNotice, Page, Tabs } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import type { DateRange } from '../../lib/dates'
import { CategoriesTab } from './CategoriesTab'
import { ExpensesTab } from './ExpensesTab'
import { MovementsTab } from './MovementsTab'
import type { ExpenseCategory } from './types'
import './gastos.css'

type Tab = 'expenses' | 'movements' | 'categories'

export default function GastosPage() {
  const { t } = useTranslation('gastos')
  const { business } = useBusiness()
  const businessId = business.id
  const { today } = useFormat()
  const [tab, setTab] = useState<Tab>('expenses')
  const [range, setRange] = useState<DateRange>(() => ({ from: today(), to: today() }))
  const categories = useAsync(() => call(client.GET('/api/b/{businessId}/expense-categories', { params: { path: { businessId } } })) as Promise<ExpenseCategory[]>, [businessId])
  const all = categories.data ?? []

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'expenses', label: t('tab.expenses') },
          { key: 'movements', label: t('tab.movements') },
          { key: 'categories', label: t('tab.categories') },
        ]}
      />
      {tab !== 'categories' && <RangePicker value={range} onChange={setRange} />}
      {categories.error && <ErrorNotice error={categories.error} onRetry={categories.reload} />}
      {tab === 'expenses' && <ExpensesTab range={range} categories={all} />}
      {tab === 'movements' && <MovementsTab range={range} />}
      {tab === 'categories' && <CategoriesTab categories={all} onChanged={categories.reload} />}
    </Page>
  )
}
