import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, Tabs } from '../../components/ui'
import './avisos.css'
import { Inbox } from './Inbox'
import { Preferences } from './Preferences'
import { Schedules } from './Schedules'

type Tab = 'inbox' | 'schedules' | 'preferences'

/** Notificaciones: la bandeja de la persona, las programadas (dueño y admins) y qué avisos recibir. */
export default function AvisosPage() {
  const { t } = useTranslation('avisos')
  const [tab, setTab] = useState<Tab>('inbox')
  return (
    <Page title={t('common:nav.avisos')}>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: 'inbox', label: t('tab.inbox') },
          { key: 'schedules', label: t('tab.schedules') },
          { key: 'preferences', label: t('tab.preferences') },
        ]}
      />
      {tab === 'inbox' && <Inbox />}
      {tab === 'schedules' && <Schedules />}
      {tab === 'preferences' && <Preferences />}
    </Page>
  )
}
