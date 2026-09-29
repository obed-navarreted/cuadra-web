/** Fechas como texto "YYYY-MM-DD": son jornadas del negocio, sin hora ni zona (así las pide y las devuelve la API). */
export type DateRange = { from: string; to: string }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * La jornada comercial de un instante: la hora local del negocio menos su hora de corte ("02:00" por defecto). Una venta a la 1:30 a. m.
 * pertenece al día anterior, igual que en el servidor (`BusinessDayService`).
 */
export function businessDate(now: Date, timeZone: string, cutoff = '02:00'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const [ch, cm] = cutoff.split(':').map(Number)
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  const shifted = new Date(local - (ch * 60 + (cm || 0)) * 60_000)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export type PresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth'

export function presets(today: string): Record<PresetKey, DateRange> {
  const first = `${today.slice(0, 8)}01`
  const lastOfPrev = addDays(first, -1)
  return {
    today: { from: today, to: today },
    yesterday: { from: addDays(today, -1), to: addDays(today, -1) },
    last7: { from: addDays(today, -6), to: today },
    last30: { from: addDays(today, -29), to: today },
    thisMonth: { from: first, to: today },
    lastMonth: { from: `${lastOfPrev.slice(0, 8)}01`, to: lastOfPrev },
  }
}

export function isValidRange(r: DateRange): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}-\d{2}$/.test(r.to) && r.from <= r.to
}

/** "2026-09-20" → "20 sept 2026" en el idioma de la interfaz. */
export function formatDay(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}

/** Un instante ISO → fecha y hora en la zona del negocio. */
export function formatDateTime(instant: string, timeZone: string, language: string): string {
  return new Intl.DateTimeFormat(language, { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant))
}

export type DayRuleLike = { from?: string | null; timezone?: string | null; dayCutoff?: string | null }
export type ActiveRule = { timezone: string; cutoff: string }

/**
 * La regla de jornada VIGENTE en `now`: la de mayor `from` cuyo primer día ya empezó (según su propia zona y corte, como en el servidor: ADR 0011).
 * Una regla pendiente (su `from` aún no llega) no rige todavía. Sin reglas, cae a la zona y el corte del negocio.
 */
export function activeRule(rules: DayRuleLike[] | null | undefined, now: Date, fallback: { timezone?: string | null; dayCutoff?: string | null } = {}): ActiveRule {
  const sorted = [...(rules ?? [])].filter((r) => r.from && r.timezone && r.dayCutoff).sort((a, b) => (b.from ?? '').localeCompare(a.from ?? ''))
  for (const r of sorted) {
    const cutoff = (r.dayCutoff as string).slice(0, 5)
    if (businessDate(now, r.timezone as string, cutoff) >= (r.from as string)) return { timezone: r.timezone as string, cutoff }
  }
  return { timezone: fallback.timezone ?? 'UTC', cutoff: fallback.dayCutoff?.slice(0, 5) ?? '02:00' }
}
