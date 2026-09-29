import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/context'
import { GoogleButton } from '../auth/GoogleButton'
import { PlatformLogin } from '../auth/PlatformLogin'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Button, Field } from '../components/ui'

export function LoginPage() {
  const { t } = useTranslation()
  const { signInWithGoogle, signInWithToken, error } = useAuth()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  return (
    <main className="center-page">
      <h1 className="login-title">{t('app.name')}</h1>
      <p className="lead">{t('app.tagline')}</p>
      <GoogleButton onCredential={(idToken) => void signInWithGoogle(idToken)} />
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`, { defaultValue: t('errors.generic') })}
        </p>
      )}
      {import.meta.env.DEV && (
        <form
          className="dev-login"
          onSubmit={(e) => {
            e.preventDefault()
            if (token.trim()) void signInWithToken(token)
          }}
        >
          <Field label={t('shell.devToken')} hint={t('shell.devTokenHint')}>
            <input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit" kind="dark" disabled={!token.trim()}>
            {t('shell.enter')}
          </Button>
        </form>
      )}
      <small className="muted">{t('auth.hint')}</small>
      <PlatformLogin onSuccess={() => navigate('/console', { replace: true })} />
      <LanguageSwitcher />
    </main>
  )
}
