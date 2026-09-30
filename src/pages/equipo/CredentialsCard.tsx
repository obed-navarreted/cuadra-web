import { useTranslation } from 'react-i18next'
import { useBusiness } from '../../auth/context'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/ui'
import { credentialsMessage, formatAccessCode, normalizeAccessCode } from './lib'
import { copyText, shareText, useFeedback } from './share'

/** Después de crear a una persona: lo que hay que decirle (código del negocio + usuario + PIN). El PIN se ve una sola vez. */
export function CredentialsCard({ name, pin, onClose }: { name: string; pin: string; onClose: () => void }) {
  const { t } = useTranslation('equipo')
  const { business } = useBusiness()
  const code = normalizeAccessCode(business.accessCode)
  const message = credentialsMessage(t, business.name ?? '', code, name, pin)
  const feedback = useFeedback()
  return (
    <Modal open title={t('created.title')} onClose={onClose}>
      <p>{t('created.intro', { name })}</p>
      <dl className="creds">
        <div>
          <dt>{t('created.business')}</dt>
          <dd>{business.name}</dd>
        </div>
        <div>
          <dt>{t('created.code')}</dt>
          <dd className="code" aria-label={formatAccessCode(code)}>
            {code || '—'}
          </dd>
        </div>
        <div>
          <dt>{t('created.username')}</dt>
          <dd>{name}</dd>
        </div>
        <div>
          <dt>{t('created.pin')}</dt>
          <dd className="code">{pin}</dd>
        </div>
      </dl>
      <p className="notice warn">{t('created.once')}</p>
      {feedback.state && (
        <p className="notice ok" role="status">
          {feedback.state === 'copied' ? t('accessCode.copied') : feedback.state === 'failed' ? t('accessCode.copyFailed') : ''}
        </p>
      )}
      <div className="dialog-actions">
        <Button onClick={async () => feedback.set((await copyText(message)) ? 'copied' : 'failed')}>{t('created.copy')}</Button>
        <Button
          onClick={async () => {
            const r = await shareText(t('accessCode.shareTitle', { business: business.name }), message)
            if (r === 'copied') feedback.set('copied')
            else if (r === 'failed') feedback.set('failed')
          }}
        >
          {t('created.share')}
        </Button>
        <Button kind="primary" onClick={onClose}>
          {t('created.done')}
        </Button>
      </div>
    </Modal>
  )
}
