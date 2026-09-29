import { useEffect, useState } from 'react'
import { businessDate } from '../../lib/dates'

/** Valor que solo cambia cuando la persona deja de escribir (para no llamar a la API en cada tecla). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Días entre dos fechas "YYYY-MM-DD". */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Antigüedad en jornadas del negocio (no en horas): un fiado de "ayer a las 11 p. m." tiene 1 día aunque hayan pasado 3 horas. */
export function ageInDays(instant: string, today: string, timeZone: string, cutoff: string): number {
  return Math.max(0, daysBetween(businessDate(new Date(instant), timeZone, cutoff), today))
}

/** Teléfono → enlace que abre el chat de WhatsApp (sin texto: los mensajes los comparte la app manualmente). Vacío si no hay dígitos suficientes. */
export function whatsappUrl(phone: string | undefined | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}` : null
}

export const PAY_METHODS = ['CASH', 'TRANSFER', 'CARD', 'OTHER'] as const
export type PayMethod = (typeof PAY_METHODS)[number]
