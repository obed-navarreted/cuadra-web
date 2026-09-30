import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../api/http'
import { errorText } from '../lib/errors'
import { Button } from './ui'

/** «Cerrar todas mis sesiones»: cierra las sesiones de esta persona (web y teléfono) menos la actual. Pide una confirmación en el mismo lugar. */
export function SignOutAll() {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<unknown>(null)
  const run = async () => {
    setState('busy')
    setError(null)
    try {
      await call(client.POST('/api/me/sessions/revoke-all'))
      setState('done')
    } catch (e) {
      setError(e)
      setState('idle')
    }
  }
  if (state === 'done') return <span className="muted small" role="status">{t('account.signOutAllDone')}</span>
  return (
    <>
      {state === 'confirm' || state === 'busy' ? (
        <>
          <span className="muted small">{t('account.signOutAllAsk')}</span>
          <Button small kind="primary" disabled={state === 'busy'} onClick={() => void run()}>
            {t('account.signOutAllConfirm')}
          </Button>
          <Button small disabled={state === 'busy'} onClick={() => setState('idle')}>
            {t('dialog.cancel')}
          </Button>
        </>
      ) : (
        <Button small onClick={() => setState('confirm')}>
          {t('account.signOutAll')}
        </Button>
      )}
      {error != null && <span className="notice error" role="alert">{errorText(t, error)}</span>}
    </>
  )
}
