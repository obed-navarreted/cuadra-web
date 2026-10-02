import { useTranslation } from 'react-i18next'
import { NavLink, useMatch } from 'react-router-dom'
import { useAuth, useBusiness } from '../../auth/context'
import { Page } from '../../components/ui'
import './ajustes.css'
import { Activity } from './Activity'
import { BusinessCards } from './BusinessCards'
import { DangerZone } from './DangerZone'
import { Templates } from './Templates'

/** Ajustes del negocio. El dueño y los admins editan los ajustes; la zona de peligro (eliminar, traspasar) y el código de acceso son solo del dueño. */
export default function AjustesPage() {
  const { t } = useTranslation('ajustes')
  const { isOwner, canUsePanel } = useAuth()
  const { business } = useBusiness()
  const onActivity = useMatch('/ajustes/actividad') !== null && canUsePanel
  return (
    <Page title={t('common:nav.ajustes')} subtitle={business.name}>
      {canUsePanel && (
        <nav className="aj-tabs" aria-label={t('common:nav.ajustes')}>
          <NavLink end to="/ajustes" className={({ isActive }) => `chip${isActive ? ' on' : ''}`}>
            {t('activity.tab')}
          </NavLink>
          <NavLink to="/ajustes/actividad" className={({ isActive }) => `chip${isActive ? ' on' : ''}`}>
            {t('activity.title')}
          </NavLink>
        </nav>
      )}
      {onActivity ? (
        <Activity />
      ) : (
        <>
          {business.status === 'DELETING' && <p className="notice error">{t('danger.deleting')}</p>}
          {/* La clave reinicia los formularios si se elige otro negocio. */}
          <BusinessCards key={business.id} />
          <Templates />
          {isOwner ? <DangerZone /> : <p className="notice warn">{t('ownerOnlyActions')}</p>}
        </>
      )}
    </Page>
  )
}
