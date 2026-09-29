import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field } from '../components/ui'
import { useAuth } from './context'

/** Acceso discreto de la plataforma: un enlace que muestra usuario y contraseña. La contraseña nunca se guarda ni se registra y se borra al enviar. */
export function PlatformLogin({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const { signInWithPlatform, error } = useAuth()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!open) {
    return (
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        {t('platformLogin.link')}
      </button>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const u = username.trim()
    if (!u || !password || busy) return
    const p = password
    setPassword('')
    setBusy(true)
    setFailed(false)
    const ok = await signInWithPlatform(u, p)
    setBusy(false)
    if (ok) onSuccess()
    else setFailed(true)
  }

  return (
    <form className="dev-login" onSubmit={(e) => void submit(e)} aria-label={t('platformLogin.title')}>
      <strong>{t('platformLogin.title')}</strong>
      <Field label={t('platformLogin.username')}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field label={t('platformLogin.password')}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      {failed && error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`, { defaultValue: t('errors.generic') })}
        </p>
      )}
      <Button type="submit" kind="dark" disabled={busy || !username.trim() || !password}>
        {t('platformLogin.submit')}
      </Button>
    </form>
  )
}
