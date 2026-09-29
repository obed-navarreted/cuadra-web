import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED = ['es', 'en'] as const
export type Locale = (typeof SUPPORTED)[number]

const STORAGE_KEY = 'cuadra.locale'

/**
 * Cada área de la web tiene su propio archivo por idioma: `locales/<idioma>/<área>.json` (y `common.json` para lo compartido).
 * Así varias personas pueden trabajar en pantallas distintas sin pisarse, y la prueba de paridad revisa cada área.
 */
const files = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', { eager: true, import: 'default' })

export function buildResources(): Record<string, Record<string, Record<string, unknown>>> {
  const resources: Record<string, Record<string, Record<string, unknown>>> = {}
  for (const [path, content] of Object.entries(files)) {
    const m = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
    if (!m) continue
    const [, lng, ns] = m
    ;(resources[lng] ??= {})[ns] = content
  }
  return resources
}

/** Idioma guardado, o el del navegador si es uno de los soportados, o español. */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (SUPPORTED as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    /* almacenamiento bloqueado: se sigue con el idioma del navegador */
  }
  const nav = navigator.language?.slice(0, 2)
  return (SUPPORTED as readonly string[]).includes(nav) ? (nav as Locale) : 'es'
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* sin almacenamiento: el cambio vale solo para esta sesión */
  }
  document.documentElement.lang = locale
  return i18n.changeLanguage(locale)
}

const resources = buildResources()

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: 'es',
  defaultNS: 'common',
  ns: Object.keys(resources.es ?? {}),
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
})
document.documentElement.lang = i18n.language

export default i18n
