import { useEffect, useState, useSyncExternalStore } from 'react'
import { endViewAs, getViewAs, subscribe, type ViewAsInfo } from './session'

/** Segundos que le quedan a la sesión "Ver como" (nunca negativo). */
export function secondsLeft(expiresAt: string | number, now: number): number {
  const end = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt)
  if (Number.isNaN(end)) return 0
  return Math.max(0, Math.ceil((end - now) / 1000))
}

/** `mm:ss` (los minutos pueden pasar de 59, aunque la sesión dura 30). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** La sesión "Ver como" activa (o null), al día cuando cambia. */
export function useViewAs(): ViewAsInfo | null {
  return useSyncExternalStore(subscribe, getViewAs)
}

/** Cuenta atrás de la sesión "Ver como": al llegar a cero sale sola y devuelve la sesión del admin. */
export function useViewAsCountdown(info: ViewAsInfo | null): number {
  const [now, setNow] = useState(() => Date.now())
  const left = info ? secondsLeft(info.expiresAt, now) : 0
  useEffect(() => {
    if (!info) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [info])
  useEffect(() => {
    if (info && left <= 0) endViewAs()
  }, [info, left])
  return left
}
