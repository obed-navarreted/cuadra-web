import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errorText } from '../lib/errors'
import { Modal } from './Modal'
import { Button, Field } from './ui'

/**
 * Confirmación de una acción que no se deshace (eliminar, anular, reabrir), con motivo escrito. `required` obliga a escribirlo. Si la acción falla,
 * el error se muestra dentro del diálogo y no se cierra; `describe` permite traducir un código propio de la pantalla (p. ej. EXPENSE_LINKED).
 */
export function ReasonDialog({
  open,
  title,
  body,
  confirmLabel,
  required = false,
  minLength = 0,
  hint,
  extra,
  canConfirm = true,
  danger = true,
  onConfirm,
  onClose,
  describe,
}: {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel: string
  required?: boolean
  /** Letras mínimas del motivo (la consola de plataforma pide 5). Implica `required`. */
  minLength?: number
  hint?: string
  /** Campos propios de la acción (p. ej. cuántos días), antes del motivo. */
  extra?: ReactNode
  /** Otra condición para poder confirmar (p. ej. escribir el nombre del negocio). */
  canConfirm?: boolean
  danger?: boolean
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
  describe?: (error: unknown) => string | null
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const close = () => {
    setReason('')
    setError(null)
    onClose()
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      setReason('')
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const mustWrite = required || minLength > 0
  const enough = reason.trim().length >= Math.max(minLength, mustWrite ? 1 : 0)
  const message = error ? (describe?.(error) ?? errorText(t, error)) : null
  return (
    <Modal open={open} title={title} onClose={close}>
      {body && <div className="muted">{body}</div>}
      {extra}
      <Field label={mustWrite ? t('dialog.reason') : t('dialog.reasonOptional')} hint={hint}>
        <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      {message && (
        <p className="notice error" role="alert">
          {message}
        </p>
      )}
      <div className="row">
        <Button onClick={close}>{t('dialog.cancel')}</Button>
        <Button kind={danger ? 'danger' : 'primary'} disabled={busy || !canConfirm || !enough} onClick={() => void submit()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
