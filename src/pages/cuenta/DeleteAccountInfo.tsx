import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import './cuenta.css'

/**
 * Página PÚBLICA (sin iniciar sesión) que explica cómo eliminar la cuenta y los datos: es la dirección que pide la ficha de Google Play.
 * `/eliminar-cuenta` en español y `/delete-account` en inglés.
 */
export function DeleteAccountInfo({ lang }: { lang: 'es' | 'en' }) {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT(lang)
  const other = lang === 'es' ? { to: '/delete-account', label: 'English' } : { to: '/eliminar-cuenta', label: 'Español' }
  const steps = t('deletePage.ownerSteps', { returnObjects: true }) as string[]
  const kept = t('deletePage.keptItems', { returnObjects: true }) as string[]
  return (
    <main className="delete-info" lang={lang}>
      <header>
        <strong className="brand">{t('app.name')}</strong>
        <Link to={other.to}>{other.label}</Link>
      </header>
      <h1>{t('deletePage.title')}</h1>
      <p>{t('deletePage.intro')}</p>
      <h2>{t('deletePage.ownerTitle')}</h2>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h2>{t('deletePage.teamTitle')}</h2>
      <p>{t('deletePage.teamBody')}</p>
      <h2>{t('deletePage.dataTitle')}</h2>
      <p>{t('deletePage.dataBody')}</p>
      <ul>
        {kept.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <h2>{t('deletePage.helpTitle')}</h2>
      <p>{t('deletePage.helpBody')}</p>
      <p>
        <Link to="/login">{t('deletePage.signIn')}</Link>
      </p>
    </main>
  )
}
