import { useTranslation } from 'react-i18next'
import { Tag } from '../../components/ui'
import { saleTags, type SaleRow } from './types'

/** Etiquetas para revisar: venta en conflicto, llegada después de la baja de quien la hizo, hora corregida, con devolución. */
export function SaleTags({ sale }: { sale: Pick<SaleRow, 'conflictOfSaleId' | 'reviewFlag' | 'returnedMinor'> }) {
  const { t } = useTranslation('ventas')
  return (
    <>
      {saleTags(sale).map((tag) => (
        <Tag key={tag} tone={tag === 'RETURNED' ? 'neutral' : 'orange'}>
          {t(`tag.${tag}`)}
        </Tag>
      ))}
    </>
  )
}
