/** Lógica pura de la consola de plataforma (sin React): se prueba aparte. */

export const REASON_MIN = 5

/** Los 4 ajustes remotos que la consola puede editar, con la misma regla que valida el servidor. */
export const CONFIG_KEYS = ['donation_url', 'donation_mode', 'min_app_version', 'recommended_app_version'] as const
export type ConfigKey = (typeof CONFIG_KEYS)[number]

const CONFIG_RULES: Record<ConfigKey, RegExp> = {
  donation_url: /^https:\/\/\S{4,300}$/,
  donation_mode: /^[A-Za-z_]{2,30}$/,
  min_app_version: /^\d{1,4}(\.\d{1,4}){0,3}$/,
  recommended_app_version: /^\d{1,4}(\.\d{1,4}){0,3}$/,
}

/** Un valor vacío borra la clave (vale). Devuelve false si no cumple el formato. */
export function isValidConfigValue(key: ConfigKey, value: string): boolean {
  const v = value.trim()
  return v === '' || CONFIG_RULES[key].test(v)
}

export const FLAG_KEYS = ['early_access', 'extended_history', 'beta_features'] as const
export const PLANS = ['FREE', 'PRO'] as const
export const PLAN_STATUSES = ['MANUAL', 'ACTIVE', 'CANCELED', 'PAST_DUE'] as const
export const AUDIENCES = ['OWNERS', 'OWNERS_ADMINS', 'ALL'] as const
export type Audience = (typeof AUDIENCES)[number]

/** Porcentaje entero (0–100) de la cohorte que siguió activa; una cohorte vacía es 0. */
export function retentionPct(active: number, size: number): number {
  if (size <= 0 || active <= 0) return 0
  return Math.min(100, Math.round((active / size) * 100))
}

export type CohortInput = { week?: string | null; size: number; active?: number[] | null }
export type CohortRow = { week: string; size: number; cells: number[] }

const WEEK_MS = 7 * 24 * 3600 * 1000

/**
 * Una fila de la tabla de retención: % de la cohorte activa en la semana 0, 1, 2… hasta la semana actual. El servidor solo manda hasta la última
 * semana con actividad; las que siguen (ya transcurridas) valen 0 %, y las futuras no se muestran.
 */
export function cohortRow(c: CohortInput, now: number): CohortRow {
  const active = c.active ?? []
  const start = c.week ? Date.parse(`${c.week}T00:00:00Z`) : NaN
  const elapsed = Number.isNaN(start) ? 0 : Math.max(0, Math.floor((now - start) / WEEK_MS))
  const last = Math.max(elapsed, active.length - 1)
  return { week: c.week ?? '', size: c.size, cells: Array.from({ length: last + 1 }, (_, k) => retentionPct(active[k] ?? 0, c.size)) }
}

/** `PRO:TRIALING` → `{ plan: 'PRO', status: 'TRIALING' }`. */
export function splitPlanKey(key: string): { plan: string; status: string | null } {
  const i = key.indexOf(':')
  return i < 0 ? { plan: key, status: null } : { plan: key.slice(0, i), status: key.slice(i + 1) }
}

type Tr = (key: string, options?: { defaultValue?: string }) => string

/** Etiqueta legible de una clave de plan: `PRO:TRIALING` → "Pro · En prueba". Lo desconocido se muestra tal cual. */
export function planKeyLabel(key: string, t: Tr): string {
  const { plan, status } = splitPlanKey(key)
  const p = t(`plan.${plan}`, { defaultValue: plan })
  return status ? `${p} · ${t(`planStatus.${status}`, { defaultValue: status })}` : p
}

/** Texto separado por comas, espacios o saltos de línea → lista sin vacíos ni repetidos. */
export function splitList(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))]
}

export type SegmentForm = { countries: string; plans: string; appVersions: string; businessIds: string }
export type Segment = { countries?: string[]; plans?: string[]; appVersions?: string[]; businessIds?: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Arma el segmento con solo las listas que tienen algo (países y planes en mayúsculas, como los compara el servidor). */
export function buildSegment(f: SegmentForm): Segment {
  const seg: Segment = {}
  const countries = splitList(f.countries).map((c) => c.toUpperCase())
  const plans = splitList(f.plans).map((p) => p.toUpperCase())
  const appVersions = splitList(f.appVersions)
  const businessIds = splitList(f.businessIds).map((b) => b.toLowerCase())
  if (countries.length) seg.countries = countries
  if (plans.length) seg.plans = plans
  if (appVersions.length) seg.appVersions = appVersions
  if (businessIds.length) seg.businessIds = businessIds
  return seg
}

export function segmentIsEmpty(seg: Segment): boolean {
  return Object.keys(seg).length === 0
}

export type AnnouncementForm = SegmentForm & {
  title: string
  body: string
  deepLink: string
  audience: Audience
  banner: boolean
  bannerUntil: string
  mode: 'now' | 'schedule'
  scheduledAt: string
}

export const EMPTY_ANNOUNCEMENT: AnnouncementForm = {
  title: '',
  body: '',
  deepLink: '',
  audience: 'OWNERS',
  countries: '',
  plans: '',
  appVersions: '',
  businessIds: '',
  banner: false,
  bannerUntil: '',
  mode: 'now',
  scheduledAt: '',
}

export type AnnouncementProblem = 'titleRequired' | 'titleTooLong' | 'bodyRequired' | 'bodyTooLong' | 'deepLinkTooLong' | 'businessIds' | 'bannerSegment' | 'bannerUntilPast' | 'scheduleRequired' | 'schedulePast'

export const TITLE_MAX = 80
export const BODY_MAX = 500
export const LINK_MAX = 200

/** `datetime-local` (hora del navegador) → instante ISO; vacío o inválido → null. */
export function localToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Las mismas reglas que valida el servidor, para avisar antes de enviar (el servidor sigue siendo quien decide). */
export function validateAnnouncement(f: AnnouncementForm, now: number): AnnouncementProblem[] {
  const out: AnnouncementProblem[] = []
  const title = f.title.trim()
  const body = f.body.trim()
  if (!title) out.push('titleRequired')
  else if (title.length > TITLE_MAX) out.push('titleTooLong')
  if (!body) out.push('bodyRequired')
  else if (body.length > BODY_MAX) out.push('bodyTooLong')
  if (f.deepLink.trim().length > LINK_MAX) out.push('deepLinkTooLong')
  const seg = buildSegment(f)
  if ((seg.businessIds ?? []).some((id) => !UUID.test(id))) out.push('businessIds')
  if (f.banner && !segmentIsEmpty(seg)) out.push('bannerSegment')
  const until = localToIso(f.bannerUntil)
  if (f.banner && until && Date.parse(until) <= now) out.push('bannerUntilPast')
  if (f.mode === 'schedule') {
    const at = localToIso(f.scheduledAt)
    if (!at) out.push('scheduleRequired')
    else if (Date.parse(at) < now - 60_000) out.push('schedulePast')
  }
  return out
}

/** El cuerpo de `POST /api/platform/announcements` a partir del formulario ya validado. */
export function buildAnnouncementInput(f: AnnouncementForm) {
  const segment = buildSegment(f)
  return {
    title: f.title.trim(),
    body: f.body.trim(),
    deepLink: f.deepLink.trim() || undefined,
    audience: f.audience,
    segment,
    banner: f.banner,
    bannerUntil: f.banner ? (localToIso(f.bannerUntil) ?? undefined) : undefined,
    scheduledAt: f.mode === 'schedule' ? (localToIso(f.scheduledAt) ?? undefined) : undefined,
  }
}

export type DayPoint = { day: string; sales: number; businesses: number }

/** Rellena con ceros los días sin ventas: los `days` últimos días hasta `endDay` (AAAA-MM-DD, UTC), en orden. */
export function fillDays(points: { day?: string | null; sales: number; businesses: number }[], endDay: string, days = 30): DayPoint[] {
  const byDay = new Map(points.filter((p) => p.day).map((p) => [p.day as string, p]))
  const end = Date.parse(`${endDay}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    const p = byDay.get(day)
    return { day, sales: p?.sales ?? 0, businesses: p?.businesses ?? 0 }
  })
}

/** ¿La franja de un anuncio sigue vigente (se puede terminar)? */
export function bannerIsLive(a: { banner: boolean; state?: string | null; bannerUntil?: string | null }, now: number): boolean {
  if (!a.banner || a.state === 'CANCELLED') return false
  return !a.bannerUntil || Date.parse(a.bannerUntil) > now
}
