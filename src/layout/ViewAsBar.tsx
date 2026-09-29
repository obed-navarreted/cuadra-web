import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { endViewAs } from '../auth/session'
import { formatCountdown, useViewAs, useViewAsCountdown } from '../auth/viewAs'
import { Button } from '../components/ui'
import './viewas.css'

/** Franja fija arriba mientras el admin de plataforma mira un negocio como soporte (solo lectura, 30 minutos). */
export function ViewAsBar() {
  const { t } = useTranslation('consola')
  const info = useViewAs()
  const left = useViewAsCountdown(info)
  const ref = useRef<HTMLDivElement>(null)

  // El resto del marco (barra superior y menú) baja lo que mida la franja para no quedar tapado.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`)
    set()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set)
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      document.documentElement.style.removeProperty('--bar-h')
    }
  }, [info])

  if (!info) return null
  return (
    <div ref={ref} className="viewas-bar" role="status">
      <span className="grow">
        {t('viewAs.banner', { business: info.businessName })} <strong className="viewas-time">{t('viewAs.expires', { time: formatCountdown(left) })}</strong>
      </span>
      <Button small kind="dark" onClick={() => endViewAs()}>
        {t('viewAs.exit')}
      </Button>
    </div>
  )
}

/** Cuando termina "Ver como" (por el botón, por el tiempo o porque el token venció) se vuelve a la consola. */
export function ViewAsExitRedirect() {
  const info = useViewAs()
  const navigate = useNavigate()
  const was = useRef(false)
  useEffect(() => {
    if (was.current && !info) navigate('/console', { replace: true })
    was.current = info !== null
  }, [info, navigate])
  return null
}
