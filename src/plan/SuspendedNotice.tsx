import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, Page } from '../components/ui'
import './plan.css'

/** Página completa para un negocio suspendido por la plataforma: se explica y se dice a quién escribir. */
export function SuspendedNotice() {
  const { t } = useTranslation('plan')
  return (
    <Page title={t('suspended.title')}>
      <Card tone="orange">
        <div className="plan-gate">
          <p>{t('suspended.body')}</p>
          <div className="row">
            <Link className="btn primary" to="/ayuda">
              {t('suspended.contact')}
            </Link>
          </div>
        </div>
      </Card>
    </Page>
  )
}
