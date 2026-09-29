import { useTranslation } from 'react-i18next'
import './plan.css'

/** Etiqueta pequeña "Pro" junto a lo que el plan actual no incluye. */
export function ProTag() {
  const { t } = useTranslation('plan')
  return <span className="pro-tag">{t('proTag')}</span>
}
