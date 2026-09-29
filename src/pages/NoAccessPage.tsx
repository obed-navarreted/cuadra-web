import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/context'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Button } from '../components/ui'

/** Quien no es dueño ni admin de ningún negocio no usa el panel: se le explica y puede cerrar sesión. */
export function NoAccessPage({ reason }: { reason: 'role' | 'none' }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    <main className="center-page">
      <h1>{reason === 'none' ? t('shell.noBusinesses') : t('shell.noAccessTitle')}</h1>
      {reason === 'role' && <p className="muted">{t('shell.noAccessBody')}</p>}
      <div className="row">
        <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
        <LanguageSwitcher />
      </div>
    </main>
  )
}
