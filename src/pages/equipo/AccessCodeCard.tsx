import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useBusiness } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button, Card, ErrorNotice, Field } from '../../components/ui'
import { renewAccessCode, setAccessCode } from './api'
import { accessShareMessage, formatAccessCode, isValidAccessCode, normalizeAccessCode, sanitizeAccessCode } from './lib'
import { copyText, shareText, useFeedback } from './share'

/** El código del negocio: lo ven el dueño y los administradores; solo el dueño lo renueva. */
export function AccessCodeCard() {
  const { t } = useTranslation('equipo')
  const { business, membership } = useBusiness()
  const { reloadBusiness } = useAuth()
  const code = normalizeAccessCode(business.accessCode)
  const message = accessShareMessage(t, business.name ?? '', code)
  const feedback = useFeedback()
  const [confirm, setConfirm] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function renew() {
    setBusy(true)
    setError(null)
    try {
      await renewAccessCode(business.id)
      await reloadBusiness()
      setConfirm(false)
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  return (
    <Card title={t('accessCode.title')} tone="green">
      <div className="access-code">
        {code ? (
          <output className="access-code-value code" aria-label={t('accessCode.aria', { spaced: formatAccessCode(code) })}>
            {code}
          </output>
        ) : (
          <p className="muted">{t('accessCode.missing')}</p>
      )}
        <div className="access-code-actions">
          <Button kind="primary" disabled={!code} onClick={async () => feedback.set((await copyText(code)) ? 'copied' : 'failed')}>
            {t('accessCode.copy')}
          </Button>
          <Button
            disabled={!code}
            onClick={async () => {
              const r = await shareText(t('accessCode.shareTitle', { business: business.name }), message)
              if (r === 'copied') feedback.set('copied')
              else if (r === 'failed') feedback.set('failed')
            }}
          >
            {t('accessCode.share')}
          </Button>
          {membership.role === 'OWNER' && (
            <>
              <Button
                onClick={() => {
                  setError(null)
                  setConfirm(true)
                }}
              >
                {t('accessCode.renew')}
              </Button>
              <Button onClick={() => setChoosing(true)}>{t('accessCode.choose')}</Button>
            </>
          )}
        </div>
      </div>
      <p className="muted access-code-explain">{t('accessCode.explain')}</p>
      {feedback.state && (
        <p className="notice ok feedback" role="status">
          {feedback.state === 'copied' ? t('accessCode.copied') : feedback.state === 'failed' ? t('accessCode.copyFailed') : ''}
        </p>
      )}
      {confirm && (
        <Modal open title={t('accessCode.renewTitle')} onClose={() => setConfirm(false)}>
          <p>{t('accessCode.renewBody')}</p>
          {error != null && <ErrorNotice error={error} />}
          <div className="dialog-actions">
            <Button onClick={() => setConfirm(false)}>{t('cancel')}</Button>
            <Button kind="danger" disabled={busy} onClick={renew}>
              {t('accessCode.renewConfirm')}
            </Button>
          </div>
        </Modal>
      )}
      {choosing && <ChooseCodeDialog businessId={business.id} current={code} onClose={() => setChoosing(false)} onSaved={reloadBusiness} />}
    </Card>
  )
}

/** Elegir un código propio: 5 dígitos, el primero no es 0. Se valida mientras se escribe; el servidor confirma que no lo use otro negocio. */
function ChooseCodeDialog({ businessId, current, onClose, onSaved }: { businessId: string; current: string; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation('equipo')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const valid = isValidAccessCode(value)
  const same = valid && value === current

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || same) return
    setBusy(true)
    setError(null)
    try {
      await setAccessCode(businessId, value)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal open title={t('accessCode.chooseTitle')} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <p className="muted">{t('accessCode.chooseHint')}</p>
        <Field label={t('accessCode.chooseLabel')}>
          <input
            className="code code-input-big"
            inputMode="numeric"
            autoComplete="off"
            pattern="[1-9]\d{4}"
            maxLength={5}
            value={value}
            aria-invalid={value !== '' && !valid}
            onChange={(e) => {
              setError(null)
              setValue(sanitizeAccessCode(e.target.value))
            }}
            required
          />
        </Field>
        <p className={`small ${valid ? 'ok-text' : 'muted'}`} role="status">
          {value === '' ? '' : valid ? t('accessCode.chooseOk') : t('accessCode.chooseFormat')}
        </p>
        <p className="muted small">{t('accessCode.chooseBody')}</p>
        {error != null && <ErrorNotice error={error} />}
        <div className="dialog-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" kind="primary" disabled={busy || !valid || same}>
            {t('accessCode.chooseSave')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
