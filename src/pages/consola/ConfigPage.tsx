import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReasonDialog } from '../../components/ReasonDialog'
import { Button, Card, ErrorNotice, Field, Page, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { getConfig, setConfig } from './api'
import { CONFIG_KEYS, REASON_MIN, isValidConfigValue, type ConfigKey } from './lib'

export function ConfigPage() {
  const { t } = useTranslation('consola')
  const cfg = useAsync(getConfig, [])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<ConfigKey | null>(null)


  return (
    <Page title={t('nav.config')} subtitle={t('config.subtitle')}>
      {cfg.error && <ErrorNotice error={cfg.error} onRetry={cfg.reload} />}
      {!cfg.data && !cfg.error && <Spinner />}
      {cfg.data &&
        CONFIG_KEYS.map((key) => {
          const current = cfg.data?.[key] ?? ''
          const draft = drafts[key] ?? current
          const valid = isValidConfigValue(key, draft)
          const changed = draft.trim() !== current
          return (
            <Card key={key} title={<code>{key}</code>}>
              <p className="muted small">{t(`config.help.${key}`)}</p>
              <Field label={t('config.value')} hint={current ? t('config.current', { value: current }) : t('config.notSet')}>
                <input value={draft} aria-invalid={!valid} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
              </Field>
              {!valid && (
                <p className="notice error" role="alert">
                  {t(`config.invalid.${key}`)}
                </p>
              )}
              <div className="row">
                <Button kind="primary" disabled={!valid || !changed} onClick={() => setSaving(key)}>
                  {draft.trim() === '' ? t('config.clear') : t('config.save')}
                </Button>
                <span className="muted small">{t('config.blankClears')}</span>
              </div>
            </Card>
          )
        })}
      <ReasonDialog
        open={saving !== null}
        title={saving ? t('config.dialogTitle', { key: saving }) : ''}
        body={saving && (drafts[saving] ?? cfg.data?.[saving] ?? '').trim() === '' ? t('config.dialogClear') : undefined}
        confirmLabel={t('config.confirm')}
        minLength={REASON_MIN}
        hint={t('reasonHint', { min: REASON_MIN })}
        danger={false}
        onClose={() => setSaving(null)}
        onConfirm={async (reason) => {
          if (!saving) return
          await setConfig(saving, (drafts[saving] ?? cfg.data?.[saving] ?? '').trim(), reason)
          setDrafts((d) => {
            const { [saving]: _gone, ...rest } = d
            return rest
          })
          cfg.reload()
        }}
      />
    </Page>
  )
}
