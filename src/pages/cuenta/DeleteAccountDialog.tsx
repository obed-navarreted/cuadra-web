import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ApiError, call, client } from '../../api/http'
import { useAuth } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, Field } from '../../components/ui'
import { errorText } from '../../lib/errors'
import { deleteWord, ownedBusinesses } from './logic'

/**
 * «Eliminar mi cuenta» (lo exige Google Play). Quien es dueño de un negocio activo primero debe eliminarlo (o pasarlo a otra persona): se le explica y
 * se le lleva a Ajustes › Eliminar negocio. Sin negocios propios, se confirma escribiendo la palabra y la cuenta se borra (sus datos personales se quitan).
 */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { memberships, signOut } = useAuth()
  const owned = ownedBusinesses(memberships)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const word = deleteWord(i18n.language)

  const close = () => {
    setTyped('')
    setError(null)
    onClose()
  }
  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await call(client.DELETE('/api/me'))
      await signOut()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  const message = error ? (error instanceof ApiError && error.code === 'OWNS_BUSINESSES' ? t('account.ownsBusinesses') : errorText(t, error)) : null
  return (
    <Modal open={open} title={t('account.deleteTitle')} onClose={close}>
      {owned.length > 0 ? (
        <>
          <p>{t('account.ownsBody', { names: owned.map((m) => m.businessName).join(', ') })}</p>
          <p className="muted">{t('account.ownsHow')}</p>
          <div className="row">
            <Button onClick={close}>{t('dialog.cancel')}</Button>
            <Link className="btn primary" to="/ajustes" onClick={close}>
              {t('account.goDeleteBusiness')}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p>{t('account.deleteBody')}</p>
          <p className="muted">{t('account.teamNote')}</p>
          <Field label={t('account.typeToConfirm', { word })}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </Field>
          {message && (
            <p className="notice error" role="alert">
              {message}
            </p>
          )}
          <div className="row">
            <Button onClick={close}>{t('dialog.cancel')}</Button>
            <Button kind="danger" disabled={busy || typed.trim().toUpperCase() !== word} onClick={() => void confirm()}>
              {t('account.deleteConfirm')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
