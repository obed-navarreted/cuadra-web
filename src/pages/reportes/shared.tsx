import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, downloadFile } from '../../api/http'
import { Button, Tag } from '../../components/ui'
import { useFormat } from '../../hooks/useFormat'
import { errorText } from '../../lib/errors'
import { closingKind } from './logic'
import './reportes.css'

/** Barra de proporción (0–100). El color no es lo único que informa: siempre va junto a la cifra. */
export function Bar({ percent, tone, label }: { percent: number; tone?: 'orange'; label?: string }) {
  return (
    <span className={`bar${tone ? ` ${tone}` : ''}`} role="img" aria-label={label ?? `${Math.round(percent)} %`}>
      <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  )
}

/** Resultado de un cierre de caja: cuadró, faltó o sobró, con el monto. */
export function Difference({ minor }: { minor: number }) {
  const { t } = useTranslation('resumen')
  const { money } = useFormat()
  const kind = closingKind(minor)
  if (kind === 'balanced') return <Tag tone="green">{t('closing.balanced')}</Tag>
  return kind === 'short' ? <Tag tone="red">{t('closing.short', { amount: money(-minor) })}</Tag> : <Tag tone="orange">{t('closing.over', { amount: money(minor) })}</Tag>
}

/** Descarga un CSV del servidor con la sesión; avisa si falla. `lang` va siempre: los encabezados salen en el idioma de la interfaz. */
export function CsvButton({ path, params, label }: { path: string; params?: Record<string, string | number | undefined>; label?: ReactNode }) {
  const { t, i18n } = useTranslation('reportes')
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [failure, setFailure] = useState<unknown>(null)
  const run = async () => {
    setState('busy')
    try {
      await downloadFile(path, { ...params, lang: i18n.language })
      setState('idle')
    } catch (e) {
      setFailure(e)
      setState('error')
    }
  }
  return (
    <span className="report-actions">
      <Button small disabled={state === 'busy'} onClick={() => void run()}>
        {state === 'busy' ? t('csv.downloading') : (label ?? t('csv.download'))}
      </Button>
      {state === 'error' && (
        <span className="notice error" role="alert">
          {failure instanceof ApiError && (failure.code === 'PLAN_LIMIT' || failure.code === 'BUSINESS_SUSPENDED') ? errorText(t, failure) : t('csv.error')}
        </span>
      )}
    </span>
  )
}
