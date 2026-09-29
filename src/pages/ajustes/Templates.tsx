import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { call, client } from '../../api/http'
import { useBusiness } from '../../auth/context'
import { Button, Card, ErrorNotice, Field, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useFormat } from '../../hooks/useFormat'
import { previewTemplate, TEMPLATE_KINDS, TEMPLATE_VARIABLES, unknownVariables } from './settings'

type Locale = 'es' | 'en'

/** Plantillas de los mensajes de WhatsApp. Sin texto propio se usa el de fábrica; "Restaurar" borra el propio. Editar es de dueño y admins. */
export function Templates() {
  const { t, i18n } = useTranslation('ajustes')
  const { membership } = useBusiness()
  const businessId = membership.businessId ?? ''
  const f = useFormat()
  const list = useAsync(() => call(client.GET('/api/b/{businessId}/message-templates', { params: { path: { businessId } } })), [businessId])
  const [kind, setKind] = useState<(typeof TEMPLATE_KINDS)[number]>('REMINDER')
  const [locale, setLocale] = useState<Locale>(i18n.language === 'en' ? 'en' : 'es')
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)

  const key = `${kind}:${locale}`
  const stored = (list.data ?? []).find((x) => x.kind === kind && x.locale === locale)?.body ?? ''
  const text = draft?.key === key ? draft.text : stored
  const unknown = unknownVariables(text)
  const sample = { negocio: membership.businessName ?? '', cliente: 'Marta', fecha: f.day(f.today()), monto: f.money(25000), detalle: '2 × Queso seco', saldo: f.money(140250), pagado_linea: f.money(50000), dias: '12', desde: f.day(f.today()) }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setFailure(null)
    setSaved(false)
    try {
      await action()
      setDraft(null)
      setSaved(true)
      list.reload()
    } catch (e) {
      setFailure(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('templates.title')}>
      <p className="muted">{t('templates.hint')}</p>
      <div className="chips" role="group" aria-label={t('templates.kind')}>
        {TEMPLATE_KINDS.map((k) => (
          <button key={k} type="button" className={`chip${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => (setKind(k), setSaved(false))}>
            {t(`templates.kinds.${k}`)}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label={t('templates.language')}>
        {(['es', 'en'] as const).map((l) => (
          <button key={l} type="button" className={`chip${locale === l ? ' on' : ''}`} aria-pressed={locale === l} onClick={() => (setLocale(l), setSaved(false))}>
            {t(`common:language.${l}`)}
          </button>
        ))}
      </div>
      {list.error && <ErrorNotice error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Spinner />}
      {list.data && (
        <>
          <Field label={t('templates.body')} hint={stored ? t('templates.custom') : t('templates.factory')}>
            <textarea rows={5} value={text} placeholder={t('templates.placeholder')} onChange={(e) => (setSaved(false), setDraft({ key, text: e.target.value }))} />
          </Field>
          <div className="aj-vars" aria-label={t('templates.variables')}>
            {TEMPLATE_VARIABLES.map((v) => (
              <code key={v}>{`{${v}}`}</code>
            ))}
          </div>
          {unknown.length > 0 && <p className="notice warn">{t('templates.unknown', { list: unknown.map((v) => `{${v}}`).join(' ') })}</p>}
          {text.trim() && (
            <div>
              <span className="field-label">{t('templates.preview')}</span>
              <div className="aj-preview">{previewTemplate(text, sample)}</div>
            </div>
          )}
          {failure != null && <ErrorNotice error={failure} />}
          {saved && <p className="notice aj-ok" role="status">{t('saved')}</p>}
          <div className="aj-actions">
            {stored && (
              <Button disabled={busy} onClick={() => void run(() => call(client.DELETE('/api/b/{businessId}/message-templates/{kind}/{locale}', { params: { path: { businessId, kind, locale } } })))}>
                {t('templates.reset')}
              </Button>
            )}
            <Button kind="primary" disabled={busy || !text.trim() || text.trim() === stored.trim()} onClick={() => void run(() => call(client.PUT('/api/b/{businessId}/message-templates/{kind}/{locale}', { params: { path: { businessId, kind, locale } }, body: { body: text.trim() } })))}>
              {t('saveChanges')}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
