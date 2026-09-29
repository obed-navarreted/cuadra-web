import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, Tabs } from '../../components/ui'
import { CreditsView } from './CreditsView'
import { CustomerDialog, CustomersView } from './CustomersView'
import './fiados.css'

type Tab = 'credits' | 'customers'

/** Fiados y clientes (PLAN 9.1): la libreta, con abonos desde la web. Los mensajes de WhatsApp los comparte la app manualmente; aquí solo se abre el chat. */
export default function FiadosPage() {
  const { t } = useTranslation('fiados')
  const [tab, setTab] = useState<Tab>('credits')
  const [customerId, setCustomerId] = useState<string | null>(null)
  // Al cambiar algo desde la ficha del cliente, las listas se vuelven a montar con datos frescos.
  const [version, setVersion] = useState(0)
  return (
    <Page title={t('title')}>
      <div className="fiados-page stack">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'credits', label: t('tabs.credits') },
            { key: 'customers', label: t('tabs.customers') },
          ]}
        />
        {tab === 'credits' ? <CreditsView key={`c${version}`} onOpenCustomer={setCustomerId} /> : <CustomersView key={`u${version}`} onOpen={setCustomerId} />}
        {customerId && <CustomerDialog customerId={customerId} onClose={() => setCustomerId(null)} onChanged={() => setVersion((v) => v + 1)} />}
      </div>
    </Page>
  )
}
