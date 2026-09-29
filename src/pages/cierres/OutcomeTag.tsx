import { useTranslation } from 'react-i18next'
import { Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { outcome } from './logic'

/** Cuadró (verde), falta (rojo) o sobra (naranja), con cuánto. */
export function OutcomeTag({ differenceMinor }: { differenceMinor: number | null | undefined }) {
  const { t } = useTranslation('cierres')
  const { money } = useFormat()
  if (differenceMinor == null) return <span className="muted">—</span>
  const o = outcome(differenceMinor)
  return <Tag tone={o === 'balanced' ? 'green' : o === 'short' ? 'red' : 'orange'}>{o === 'balanced' ? t('outcome.balanced') : t(`outcome.${o}`, { amount: money(Math.abs(differenceMinor)) })}</Tag>
}
