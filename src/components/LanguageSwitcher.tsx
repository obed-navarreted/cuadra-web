import { useTranslation } from 'react-i18next'
import { SUPPORTED, setLocale, type Locale } from '../i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
      <span>{t('language.label')}</span>
      <select value={i18n.language} onChange={(e) => void setLocale(e.target.value as Locale)}>
        {SUPPORTED.map((l) => (
          <option key={l} value={l}>
            {t(`language.${l}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
