import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, Tabs } from '../../components/ui'
import { DevicesView } from './DevicesView'
import { InvitationsView } from './InvitationsView'
import { MembersView } from './MembersView'
import './equipo.css'

type Tab = 'members' | 'invitations' | 'devices'

/** Equipo (PLAN 9.1): miembros con y sin Google, invitaciones y teléfonos vinculados. Lo que un admin no puede hacer no se le muestra. */
export default function EquipoPage() {
  const { t } = useTranslation('equipo')
  const [tab, setTab] = useState<Tab>('members')
  return (
    <Page title={t('title')}>
      <div className="equipo-page stack">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'members', label: t('tabs.members') },
            { key: 'invitations', label: t('tabs.invitations') },
            { key: 'devices', label: t('tabs.devices') },
          ]}
        />
        {tab === 'members' ? <MembersView /> : tab === 'invitations' ? <InvitationsView /> : <DevicesView />}
      </div>
    </Page>
  )
}
