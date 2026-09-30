import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, Tabs } from '../../components/ui'
import { AccessCodeCard } from './AccessCodeCard'
import { DevicesView } from './DevicesView'
import { MembersView } from './MembersView'
import './equipo.css'

type Tab = 'members' | 'devices'

/** Equipo: código del negocio, personas (nombre + PIN) y teléfonos. Lo que un admin no puede hacer no se le muestra. */
export default function EquipoPage() {
  const { t } = useTranslation('equipo')
  const [tab, setTab] = useState<Tab>('members')
  return (
    <Page title={t('title')}>
      <div className="equipo-page stack">
        <AccessCodeCard />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'members', label: t('tabs.members') },
            { key: 'devices', label: t('tabs.devices') },
          ]}
        />
        {tab === 'members' ? <MembersView /> : <DevicesView />}
      </div>
    </Page>
  )
}
