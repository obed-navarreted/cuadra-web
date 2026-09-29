import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, Page } from '../components/ui'
import './plan.css'

/** Lo que se ve en lugar de una sección que el plan Gratis no incluye: explica con calma, sin borrar ni esconder nada. */
export function ProGate({ section }: { section: string }) {
  const { t } = useTranslation('plan')
  return (
    <Page title={t('gate.title', { section: t(`sections.${section}`, { defaultValue: t(`common:nav.${section}`) }) })}>
      <Card>
        <div className="plan-gate">
          <p>{t('gate.body')}</p>
          <p className="muted">{t('gate.trialTip')}</p>
          <div className="row">
            <Link className="btn primary" to="/plan">
              {t('gate.seePlan')}
            </Link>
            <Link className="btn" to="/resumen">
              {t('gate.back')}
            </Link>
          </div>
        </div>
      </Card>
    </Page>
  )
}
