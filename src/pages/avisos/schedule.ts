import type { components } from '../../api/schema'

type S = components['schemas']
export type ScheduleView = S['ScheduleView']
export type ScheduleInput = S['ScheduleInput']
export type ScheduleRule = S['ScheduleRule']

export type When = 'now' | 'once' | 'repeat'
export type Repeat = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS'
export type DraftError = 'TITLE' | 'BODY' | 'AUDIENCE' | 'DATE' | 'TIME' | 'DAYS' | 'DAY_OF_MONTH' | 'EVERY_DAYS' | 'END_DATE'

/** Lo que se va escribiendo en el editor: texto tal cual; `validateDraft` lo revisa antes de llamar al servidor. */
export type Draft = {
  id: string | null
  title: string
  body: string
  all: boolean
  roles: string[]
  memberIds: string[]
  link: string
  when: When
  date: string
  time: string
  repeat: Repeat
  days: number[]
  dayOfMonth: string
  everyDays: string
  endDate: string
}

export const TITLE_RECOMMENDED = 65
export const BODY_RECOMMENDED = 240
export const TITLE_MAX = 100
export const BODY_MAX = 500

/** Acciones al tocar el aviso (lista blanca del servidor). */
export const LINKS = ['cuadra://caja', 'cuadra://cierre', 'cuadra://fiados', 'cuadra://inventario', 'cuadra://gastos'] as const

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function emptyDraft(): Draft {
  return { id: null, title: '', body: '', all: true, roles: [], memberIds: [], link: '', when: 'repeat', date: '', time: '09:00', repeat: 'DAILY', days: [], dayOfMonth: '', everyDays: '', endDate: '' }
}

export function validTime(s: string) {
  return TIME.test(s.trim())
}

export function validDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/** Primer error del borrador (o null). El servidor valida igual: esto solo evita ir y volver. */
export function validateDraft(d: Draft): DraftError | null {
  if (!d.title.trim() || d.title.length > TITLE_MAX) return 'TITLE'
  if (!d.body.trim() || d.body.length > BODY_MAX) return 'BODY'
  if (!d.all && d.roles.length === 0 && d.memberIds.length === 0) return 'AUDIENCE'
  if (d.when === 'now') return null
  if (d.when === 'once') {
    if (!validDate(d.date)) return 'DATE'
    return validTime(d.time) ? null : 'TIME'
  }
  if (!validTime(d.time)) return 'TIME'
  if (d.repeat === 'WEEKLY' && d.days.length === 0) return 'DAYS'
  if (d.repeat === 'MONTHLY') {
    const n = Number(d.dayOfMonth)
    if (!Number.isInteger(n) || n < 1 || n > 31) return 'DAY_OF_MONTH'
  }
  if (d.repeat === 'EVERY_N_DAYS') {
    const n = Number(d.everyDays)
    if (!Number.isInteger(n) || n < 1 || n > 365) return 'EVERY_DAYS'
  }
  if (d.endDate.trim() && !validDate(d.endDate)) return 'END_DATE'
  return null
}

/** Para "Enviar ahora" el servidor ignora la regla; se manda una válida cualquiera. */
const NOW_RULE: ScheduleRule = { type: 'ONCE', at: '2000-01-01T00:00' }

export function buildRule(d: Draft): ScheduleRule {
  if (d.when === 'now') return NOW_RULE
  if (d.when === 'once') return { type: 'ONCE', at: `${d.date.trim()}T${d.time.trim()}` }
  const base: ScheduleRule = { type: d.repeat, time: d.time.trim(), ...(d.endDate.trim() ? { endDate: d.endDate.trim() } : {}) }
  if (d.repeat === 'WEEKLY') return { ...base, days: [...d.days].sort((a, b) => a - b) }
  if (d.repeat === 'MONTHLY') return { ...base, dayOfMonth: Number(d.dayOfMonth) }
  if (d.repeat === 'EVERY_N_DAYS') return { ...base, everyDays: Number(d.everyDays) }
  return base
}

export function buildInput(d: Draft, active = true): ScheduleInput {
  return {
    title: d.title.trim(),
    body: d.body.trim(),
    deepLink: d.link || undefined,
    audience: { all: d.all, roles: d.all ? [] : d.roles, memberIds: d.all ? [] : d.memberIds, deviceIds: [] },
    rule: buildRule(d),
    active,
  }
}

/** Una programación existente → borrador editable (una enviada "ahora" o de una vez vuelve como "una vez"). */
export function draftOf(s: ScheduleView): Draft {
  const r = s.rule ?? { type: 'DAILY' }
  const a = s.audience ?? {}
  const base: Draft = {
    ...emptyDraft(),
    id: s.id,
    title: s.title ?? '',
    body: s.body ?? '',
    all: a.all === true,
    roles: [...(a.roles ?? [])],
    memberIds: [...(a.memberIds ?? [])],
    link: s.deepLink ?? '',
  }
  if (r.type === 'ONCE') {
    const [date = '', time = ''] = (r.at ?? '').split('T')
    return { ...base, when: 'once', date, time: time.slice(0, 5) || '09:00' }
  }
  return {
    ...base,
    when: 'repeat',
    repeat: (['DAILY', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS'] as const).find((x) => x === r.type) ?? 'DAILY',
    time: (r.time ?? '09:00').slice(0, 5),
    days: [...(r.days ?? [])],
    dayOfMonth: r.dayOfMonth != null ? String(r.dayOfMonth) : '',
    everyDays: r.everyDays != null ? String(r.everyDays) : '',
    endDate: r.endDate ?? '',
  }
}

/** Cómo se lee una regla, como datos: la pantalla la vuelve texto en el idioma de la interfaz. */
export type RuleSummary =
  | { kind: 'once'; date: string; time: string }
  | { kind: 'daily'; time: string }
  | { kind: 'weekly'; days: number[]; time: string }
  | { kind: 'monthly'; day: number; time: string }
  | { kind: 'everyN'; n: number; time: string }

export function summarize(r: ScheduleRule): RuleSummary {
  const time = (r.time ?? '').slice(0, 5)
  switch (r.type) {
    case 'ONCE': {
      const [date = '', t = ''] = (r.at ?? '').split('T')
      return { kind: 'once', date, time: t.slice(0, 5) }
    }
    case 'WEEKLY':
      return { kind: 'weekly', days: [...(r.days ?? [])].sort((a, b) => a - b), time }
    case 'MONTHLY':
      return { kind: 'monthly', day: r.dayOfMonth ?? 1, time }
    case 'EVERY_N_DAYS':
      return { kind: 'everyN', n: r.everyDays ?? 1, time }
    default:
      return { kind: 'daily', time }
  }
}
