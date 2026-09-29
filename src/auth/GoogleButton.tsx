import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
    const s = existing ?? document.createElement('script')
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('gsi')), { once: true })
    if (!existing) {
      s.src = SCRIPT
      s.async = true
      document.head.appendChild(s)
    }
  })
}

/** Botón oficial de Google (Google Identity Services). Sin `VITE_GOOGLE_CLIENT_ID` no hay acceso real y la pantalla lo dice. */
export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const { t, i18n } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID || !box.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.google) return
        window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => onCredential(r.credential) })
        window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: i18n.language, width: 300 })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [onCredential, i18n.language])

  if (!CLIENT_ID) return <p className="notice warn">{t('shell.googleMissing')}</p>
  return (
    <div>
      <div ref={box} />
      {failed && <p className="notice warn">{t('errors.generic')}</p>}
    </div>
  )
}
