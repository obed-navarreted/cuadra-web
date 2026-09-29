import { useTranslation } from 'react-i18next'
import { Link, NavLink, useMatch } from 'react-router-dom'
import { useAuth, useBusiness } from '../../auth/context'
import { Card, Page } from '../../components/ui'
import './ajustes.css'
import { Activity } from './Activity'
import { BusinessCards } from './BusinessCards'
import { DangerZone } from './DangerZone'
import { Templates } from './Templates'

/** Ajustes del negocio. Lo exclusivo del dueño (editar, plan, zona de peligro) no se muestra a un admin; las plantillas las editan ambos. */
export default function AjustesPage() {
  const { t } = useTranslation('ajustes')
  const { isOwner } = useAuth()
  const { business } = useBusiness()
  const onActivity = useMatch('/ajustes/actividad') !== null && isOwner
  return (
    <Page title={t('common:nav.ajustes')} subtitle={business.name}>
      {isOwner && (
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
          {isOwner && (
            <Card title={t('plan.title')}>
              <p className="muted">{t('plan.summary')}</p>
              <p>
                <Link className="btn" to="/plan">
                  {t('plan.open')}
                </Link>
              </p>
            </Card>
          )}
          {isOwner && <DangerZone />}
        </>
      )}
    </Page>
  )
}
