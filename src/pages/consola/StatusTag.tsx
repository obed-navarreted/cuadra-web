import { useTranslation } from 'react-i18next'
import { Tag } from '../../components/ui'

/** Estado de un negocio: ACTIVE verde, SUSPENDED rojo. */
export function BusinessStatusTag({ status }: { status?: string | null }) {
  const { t } = useTranslation('consola')
  if (!status) return null
  return <Tag tone={status === 'ACTIVE' ? 'green' : 'red'}>{t(`status.${status}`, { defaultValue: status })}</Tag>
}
