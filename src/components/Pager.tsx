import { useTranslation } from 'react-i18next'
import { Button } from './ui'

/** Paginación de las listas del servidor (`page` empieza en 0). No se muestra si todo cabe en una página. */
export function Pager({ page, size, total, onChange }: { page: number; size: number; total: number; onChange: (page: number) => void }) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return null
  return (
    <div className="row" role="navigation">
      <Button small disabled={page <= 0} onClick={() => onChange(page - 1)}>
        {t('pager.prev')}
      </Button>
      <span className="muted small">{t('pager.page', { page: page + 1, pages })}</span>
      <Button small disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>
        {t('pager.next')}
      </Button>
    </div>
  )
}
