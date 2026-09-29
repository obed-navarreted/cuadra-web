import type { components } from '../../api/schema'

export type DayRule = components['schemas']['DayRuleView']

function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at.getTime()) / 60000)
}

/** ¿La zona cambia de hora durante el año? Compara el desfase de enero y de julio (en el hemisferio sur el verano es en enero: basta con que difieran). */
export function observesDst(timeZone: string, year = new Date().getFullYear()): boolean {
  try {
    return offsetMinutes(new Date(Date.UTC(year, 0, 1)), timeZone) !== offsetMinutes(new Date(Date.UTC(year, 6, 1)), timeZone)
  } catch {
    return false
  }
}

/** Las zonas que ofrece el navegador; siempre incluye la actual aunque el navegador no la conozca. */
export function timezoneOptions(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  return all.includes(current) ? all : [current, ...all]
}

/** ¿Conviene avisar? Zona con cambio de hora y corte antes de las 04:00 ("HH:mm"): a las 02:00 hay un salto o una hora repetida. */
export function dstCutoffTip(timeZone: string, cutoff: string, year?: number): boolean {
  return observesDst(timeZone, year) && /^\d{2}:\d{2}/.test(cutoff) && cutoff.slice(0, 5) < '04:00'
}

/** La primera regla vale "desde siempre": el servidor la marca con una fecha muy antigua. */
export function sinceForever(from: string | null | undefined): boolean {
  return !from || from < '2000-01-01'
}
