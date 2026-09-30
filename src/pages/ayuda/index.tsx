import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Button, Card, ErrorNotice, Field, Page } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { errorText } from '../../lib/errors'
import './ayuda.css'
import { buildTicket, CATEGORIES, DEFAULT_SUPPORT_EMAIL, DEFAULT_SUPPORT_WHATSAPP, MESSAGE_MAX, validateTicket, whatsappLink, type Category } from './support'

const FAQ = ['link', 'offline', 'closing', 'import'] as const

/** Ayuda: preguntas frecuentes, contacto con soporte y «Apóyame» (WhatsApp y correo; sin pagos dentro de la aplicación). */
export default function AyudaPage() {
  const { t, i18n } = useTranslation('ayuda')
  const { membership } = useBusiness()
  const config = useAsync(() => call(client.GET('/api/config')), [])
  const [category, setCategory] = useState<Category>('QUESTION')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [sent, setSent] = useState<string | null>(null)
  const draft = { category, message, email, phone }
  const error = validateTicket(draft)
  const supportEmail = config.data?.supportEmail || DEFAULT_SUPPORT_EMAIL
  const whatsapp = whatsappLink(config.data?.supportWhatsapp || DEFAULT_SUPPORT_WHATSAPP, t('support.whatsappMessage'))
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    void navigator.clipboard?.writeText(supportEmail).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    })
  }

  async function submit() {
    setTried(true)
    if (error) return
    setBusy(true)
    setFailure(null)
    try {
      const res = await call(client.POST('/api/support/tickets', { body: buildTicket(draft, membership.businessId, i18n.language, navigator.userAgent) }))
      setSent(res.reference ?? '')
      setMessage('')
      setTried(false)
    } catch (e) {
      setFailure(e)
    } finally {
      setBusy(false)
    }
  }

  const failureText = failure == null ? null : failure instanceof ApiError && failure.code === 'TOO_MANY_TICKETS' ? t('form.tooMany') : errorText(t, failure)

  return (
    <Page title={t('common:nav.ayuda')} subtitle={t('subtitle')}>
      <div className="ay-grid">
        <Card title={t('form.title')}>
          {sent != null ? (
            <div className="ay-form">
              <p className="notice ay-ok" role="status">
                {t('form.sent')}
                {sent && ` ${t('form.reference', { reference: sent })}`}
              </p>
              <div>
                <Button onClick={() => setSent(null)}>{t('form.another')}</Button>
              </div>
            </div>
          ) : (
            <form
              className="ay-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div role="group" aria-label={t('form.category')}>
                <span className="field-label">{t('form.category')}</span>
                <div className="chips">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" className={`chip${category === c ? ' on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
                      {t(`category.${c}`)}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={t('form.message')} hint={t('form.messageHint', { count: message.trim().length, max: MESSAGE_MAX })}>
                <textarea rows={6} value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'start' }}>
                <Field label={t('form.email')} hint={t('form.emailHint')}>
                  <input type="email" value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label={t('form.phone')}>
                  <input type="tel" value={phone} maxLength={40} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <p className="muted small">{t('form.privacy')}</p>
              {tried && error && (
                <p className="notice error" role="alert">
                  {t(`form.error.${error}`)}
                </p>
              )}
              {failureText && (
                <p className="notice error" role="alert">
                  {failureText}
                </p>
              )}
              <div>
                <Button type="submit" kind="primary" disabled={busy}>
                  {t('form.send')}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <div className="page">
          <Card title={t('contact.title')}>
            {config.error && <ErrorNotice error={config.error} onRetry={config.reload} />}
            <p>
              {t('contact.email')} <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </Card>
          <Card title={t('support.title')}>
            <div className="ay-support">
              <p>{t('support.body')}</p>
              {whatsapp && (
                <a className="btn primary" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  {t('support.whatsapp')}
                </a>
              )}
              <p className="muted small">{t('support.emailLabel')}</p>
              <p>
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </p>
              <div className="row">
                <Button small onClick={copyEmail}>
                  {copied ? t('support.copied') : t('support.copyEmail')}
                </Button>
                <a className="btn small" href={`mailto:${supportEmail}`}>
                  {t('support.writeEmail')}
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card title={t('faq.title')}>
        <div className="ay-faq">
          {FAQ.map((k) => (
            <details key={k}>
              <summary>{t(`faq.${k}.q`)}</summary>
              <p>{t(`faq.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </Card>
    </Page>
  )
}
