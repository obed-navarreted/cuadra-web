import type { components } from '../../api/schema'
import { decimalsOf, parseMoney } from '../../lib/money'

type S = components['schemas']
export type BusinessView = S['BusinessView']
export type UpdateBusiness = S['UpdateBusiness']

/** Módulos que el negocio puede encender o esconder (el servidor rechaza cualquier otro). */
// `shifts` sigue existiendo en la API (y su valor no se toca), pero ya no se ofrece: el cierre es automático por jornada.
export const MODULES = ['credit', 'expenses', 'inventory', 'catalog', 'team'] as const
export type ModuleKey = (typeof MODULES)[number]

/** Un módulo sin valor guardado: todos están encendidos salvo inventario y turnos (igual que en el servidor y la app). */
export function moduleOn(modules: Record<string, boolean> | null | undefined, key: string): boolean {
  const v = modules?.[key]
  return v === undefined ? key !== 'inventory' && key !== 'shifts' : v
}

export const POS_VIEWS = ['TYPE', 'QUICK', 'LIST'] as const
export const TEMPLATE_KINDS = ['CREDIT_NEW', 'PAYMENT', 'PAID_OFF', 'REMINDER', 'STATEMENT', 'TICKET'] as const
/** Variables que entienden las plantillas de WhatsApp. */
export const TEMPLATE_VARIABLES = ['negocio', 'cliente', 'fecha', 'monto', 'detalle', 'saldo', 'pagado_linea', 'dias', 'desde'] as const

export type Form = {
  name: string
  type: string
  defaultLocale: string
  dayCutoff: string
  timezone: string
  posViews: string[]
  creditRequiresCustomer: boolean
  creditLimitEnforced: boolean
  creditDefaultDueDays: string
  creditOverdueDays: string
  shiftRequired: boolean
  shiftNote: string
  country: string
  currency: string
}

/** Monto en unidad menor → texto para un campo ("1000" → "10.00"; sin usar coma flotante). */
export function minorToInput(minor: number, currency: string): string {
  const dec = decimalsOf(currency)
  if (dec === 0) return String(minor)
  const s = String(Math.abs(minor)).padStart(dec + 1, '0')
  return `${minor < 0 ? '-' : ''}${s.slice(0, -dec)}.${s.slice(-dec)}`
}

export function formOf(b: BusinessView): Form {
  return {
    name: b.name ?? '',
    type: b.type ?? '',
    defaultLocale: b.defaultLocale ?? 'es',
    dayCutoff: (b.dayCutoff ?? '02:00').slice(0, 5),
    timezone: b.timezone ?? 'UTC',
    posViews: [...(b.posViews ?? ['TYPE'])],
    creditRequiresCustomer: b.creditRequiresCustomer === true,
    creditLimitEnforced: b.creditLimitEnforced === true,
    creditDefaultDueDays: b.creditDefaultDueDays != null ? String(b.creditDefaultDueDays) : '',
    creditOverdueDays: b.creditOverdueDays != null ? String(b.creditOverdueDays) : '',
    shiftRequired: b.shiftRequired === true,
    shiftNote: b.shiftNoteThresholdMinor != null ? minorToInput(b.shiftNoteThresholdMinor, b.currency ?? 'USD') : '',
    country: b.country ?? '',
    currency: b.currency ?? '',
  }
}

export type FormError = 'NAME' | 'CUTOFF' | 'POS_VIEWS' | 'DUE_DAYS' | 'OVERDUE_DAYS' | 'SHIFT_NOTE' | 'CURRENCY'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function wholeNumber(s: string, min: number, max: number): number | null {
  if (!/^\d{1,4}$/.test(s.trim())) return null
  const n = Number(s)
  return n >= min && n <= max ? n : null
}

export function validateForm(f: Form, currency: string): FormError | null {
  if (!f.name.trim() || f.name.trim().length > 120) return 'NAME'
  if (!TIME.test(f.dayCutoff)) return 'CUTOFF'
  if (f.posViews.length === 0) return 'POS_VIEWS'
  if (f.creditDefaultDueDays.trim() && wholeNumber(f.creditDefaultDueDays, 0, 365) == null) return 'DUE_DAYS'
  if (f.creditOverdueDays.trim() && wholeNumber(f.creditOverdueDays, 1, 365) == null) return 'OVERDUE_DAYS'
  if (f.shiftNote.trim() && parseMoney(f.shiftNote, currency) == null) return 'SHIFT_NOTE'
  if (f.currency.trim() && !/^[A-Za-z]{3}$/.test(f.currency.trim())) return 'CURRENCY'
  return null
}

/**
 * Solo lo que cambió respecto al negocio guardado: el servidor actualiza únicamente los campos que llegan, así nunca pisamos algo que otra persona
 * cambió mientras esta pantalla estaba abierta. Un número vacío no se manda (el servidor no puede quitar un valor: ver informe).
 */
export function patchOf(f: Form, b: BusinessView): UpdateBusiness {
  const cur = formOf(b)
  const patch: UpdateBusiness = {}
  if (f.name.trim() !== cur.name) patch.name = f.name.trim()
  if (f.type.trim() !== cur.type.trim() && f.type.trim()) patch.type = f.type.trim()
  if (f.defaultLocale !== cur.defaultLocale) patch.defaultLocale = f.defaultLocale
  if (f.dayCutoff !== cur.dayCutoff) patch.dayCutoff = f.dayCutoff
  if (f.timezone && f.timezone !== cur.timezone) patch.timezone = f.timezone
  if (f.posViews.slice().sort().join() !== cur.posViews.slice().sort().join()) patch.posViews = f.posViews
  if (f.creditRequiresCustomer !== cur.creditRequiresCustomer) patch.creditRequiresCustomer = f.creditRequiresCustomer
  if (f.creditLimitEnforced !== cur.creditLimitEnforced) patch.creditLimitEnforced = f.creditLimitEnforced
  if (f.creditDefaultDueDays.trim() && f.creditDefaultDueDays.trim() !== cur.creditDefaultDueDays) patch.creditDefaultDueDays = Number(f.creditDefaultDueDays)
  if (f.creditOverdueDays.trim() && f.creditOverdueDays.trim() !== cur.creditOverdueDays) patch.creditOverdueDays = Number(f.creditOverdueDays)
  if (f.shiftRequired !== cur.shiftRequired) patch.shiftRequired = f.shiftRequired
  if (f.shiftNote.trim() && f.shiftNote.trim() !== cur.shiftNote) patch.shiftNoteThresholdMinor = parseMoney(f.shiftNote, b.currency ?? 'USD') ?? undefined
  if (f.country && f.country !== cur.country) patch.country = f.country
  // La moneda solo se cambia antes de la primera venta (el servidor lo exige igual: CURRENCY_LOCKED).
  if (!b.currencyLocked && f.currency.trim() && f.currency.trim().toUpperCase() !== cur.currency) patch.currency = f.currency.trim().toUpperCase()
  return patch
}

/** Reemplaza {variable} por un valor de ejemplo para mostrar cómo quedará el mensaje. Lo que no se conoce queda como está. */
export function previewTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
}

/** Variables escritas en la plantilla que no existen: se avisan antes de guardar. */
export function unknownVariables(body: string): string[] {
  const found = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  return [...new Set(found.filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v)))]
}
