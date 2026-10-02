import { formatTime } from '../../lib/dates'
import type { components } from '../../api/schema'

export type DayClose = components['schemas']['DayClose']
export type LaterVoid = components['schemas']['LaterVoid']
export type DeviceSync = components['schemas']['DeviceSync']
type MethodAmount = components['schemas']['MethodAmount']

/** Orden en que se listan los métodos; los desconocidos van al final. */
const METHOD_ORDER = ['CASH', 'TRANSFER', 'CARD', 'CREDIT', 'OTHER']

export function amountOf(list: MethodAmount[] | null | undefined, method: string): number {
  return (list ?? []).filter((m) => m.method === method).reduce((n, m) => n + m.amountMinor, 0)
}

/** Une varias listas de métodos sumando por método, en orden estable. */
export function mergeMethods(lists: (MethodAmount[] | null | undefined)[]): MethodAmount[] {
  const sums = new Map<string, number>()
  for (const l of lists) for (const m of l ?? []) if (m.method) sums.set(m.method, (sums.get(m.method) ?? 0) + m.amountMinor)
  const rank = (m: string) => (METHOD_ORDER.includes(m) ? METHOD_ORDER.indexOf(m) : METHOD_ORDER.length)
  return [...sums.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])).map(([method, amountMinor]) => ({ method, amountMinor }))
}

/** Las piezas del efectivo esperado: lo que entra al cajón menos lo que sale. Es la misma cuenta del servidor. */
export function cashParts(d: Pick<DayClose, 'byMethod' | 'creditCollected' | 'depositsMinor' | 'drawerExpensesMinor' | 'withdrawalsMinor'>) {
  return {
    cashSales: amountOf(d.byMethod, 'CASH'),
    cashCollected: amountOf(d.creditCollected, 'CASH'),
    deposits: d.depositsMinor,
    drawerExpenses: d.drawerExpensesMinor,
    withdrawals: d.withdrawalsMinor,
  }
}

/**
 * Lo que HOY corrige días anteriores o devuelve dinero (los días ya cerrados no cambian): devoluciones en efectivo, ventas de días anteriores anuladas hoy
 * (su efectivo sale del esperado) y gastos, abonos, retiros o entradas de días anteriores anulados hoy (con su efecto en el efectivo, con signo).
 */
export function cashAdjustments(d: Partial<Pick<DayClose, 'cashRefundsMinor' | 'priorCancelledCashMinor' | 'laterVoids'>>) {
  const later = (d.laterVoids ?? []).reduce((n, v) => n + v.cashEffectMinor, 0)
  return { cashRefunds: d.cashRefundsMinor ?? 0, priorCancelledCash: d.priorCancelledCashMinor ?? 0, later }
}

/** Efectivo esperado = ventas y abonos en efectivo + entradas − gastos del cajón − retiros − devoluciones en efectivo − anuladas de días anteriores ± anulaciones tardías. */
export function expectedCash(d: Parameters<typeof cashParts>[0] & Partial<Pick<DayClose, 'cashRefundsMinor' | 'priorCancelledCashMinor' | 'laterVoids'>>): number {
  const p = cashParts(d)
  const a = cashAdjustments(d)
  return p.cashSales + p.cashCollected + p.deposits - p.drawerExpenses - p.withdrawals - a.cashRefunds - a.priorCancelledCash + a.later
}

/** Une las anulaciones tardías de varios días por tipo. */
export function mergeLaterVoids(lists: (LaterVoid[] | null | undefined)[]): LaterVoid[] {
  const by = new Map<string, LaterVoid>()
  for (const l of lists)
    for (const v of l ?? []) {
      const k = v.kind ?? ''
      const cur = by.get(k)
      by.set(k, cur ? { kind: k, count: cur.count + v.count, amountMinor: cur.amountMinor + v.amountMinor, cashEffectMinor: cur.cashEffectMinor + v.cashEffectMinor } : { ...v, kind: k })
    }
  return [...by.values()]
}

/** Aviso de teléfonos que aún no envían todo: el cierre puede estar incompleto. `stale`: sin sincronizar hace más de una hora. */
export function syncWarningKind(w: Pick<DeviceSync, 'pendingOps' | 'stale'>): 'PENDING' | 'STALE' {
  return w.pendingOps > 0 ? 'PENDING' : 'STALE'
}

/** Suma de todas las jornadas de un rango (el "efectivo esperado" total es la suma de los de cada día). */
export function totals(days: DayClose[]) {
  const sum = (f: (d: DayClose) => number) => days.reduce((n, d) => n + f(d), 0)
  return {
    days: days.length,
    salesCount: sum((d) => d.salesCount),
    salesMinor: sum((d) => d.salesMinor),
    byMethod: mergeMethods(days.map((d) => d.byMethod)),
    creditCollected: mergeMethods(days.map((d) => d.creditCollected)),
    drawerExpensesMinor: sum((d) => d.drawerExpensesMinor),
    otherExpensesMinor: sum((d) => d.otherExpensesMinor),
    withdrawalsMinor: sum((d) => d.withdrawalsMinor),
    depositsMinor: sum((d) => d.depositsMinor),
    expectedCashMinor: sum((d) => d.expectedCashMinor),
    cancelledCount: sum((d) => d.cancelledCount),
    cancelledMinor: sum((d) => d.cancelledMinor),
    returnsCount: sum((d) => d.returnsCount ?? 0),
    returnsMinor: sum((d) => d.returnsMinor ?? 0),
    refundsByMethod: mergeMethods(days.map((d) => d.refundsByMethod)),
    cashRefundsMinor: sum((d) => d.cashRefundsMinor ?? 0),
    priorCancelledCount: sum((d) => d.priorCancelledCount ?? 0),
    priorCancelledMinor: sum((d) => d.priorCancelledMinor ?? 0),
    priorCancelledCashMinor: sum((d) => d.priorCancelledCashMinor ?? 0),
    netSalesMinor: sum((d) => d.netSalesMinor ?? d.salesMinor),
    laterVoids: mergeLaterVoids(days.map((d) => d.laterVoids)),
    promotionDiscountMinor: sum((d) => d.promotionDiscountMinor ?? 0),
  }
}

function stamp(instant: string, timeZone: string, language: string): string {
  const parts = new Intl.DateTimeFormat(language, { timeZone, day: 'numeric', month: 'short' }).formatToParts(new Date(instant))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month').replace(/\.$/, '')} ${formatTime(instant, timeZone)}`
}

/**
 * El idioma para las horas: en español se usa el del país del negocio (los meses cambian poco entre países; la hora ya no depende del idioma), si el navegador lo conoce.
 */
export function windowLocale(language: string, country: string | null | undefined): string {
  if (language !== 'es' || !country) return language
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([`es-${country}`]).length > 0 ? `es-${country}` : language
  } catch {
    return language
  }
}

/** La ventana exacta de una jornada en la zona del negocio: "28 sep 2:00 AM → 29 sep 2:00 AM". */
export function windowText(startsAt: string, endsAt: string, timeZone: string, language: string): string {
  return `${stamp(startsAt, timeZone, language)} → ${stamp(endsAt, timeZone, language)}`
}

/** Una jornada sin nada que mostrar (para atenuarla en la lista). */
export function isEmptyDay(d: DayClose): boolean {
  return d.salesCount === 0 && d.cancelledCount === 0 && (d.returnsCount ?? 0) === 0 && (d.priorCancelledCount ?? 0) === 0 && (d.laterVoids ?? []).length === 0 && d.drawerExpensesMinor === 0 && d.otherExpensesMinor === 0 && d.withdrawalsMinor === 0 && d.depositsMinor === 0 && (d.creditCollected ?? []).length === 0
}

/** La zona que regía en una jornada: la de la última regla que empezó ese día o antes (el negocio puede haber cambiado de zona desde entonces). */
export function zoneFor(date: string | null | undefined, rules: { from?: string | null; timezone?: string | null }[] | null | undefined, fallback: string): string {
  if (!date) return fallback
  const sorted = [...(rules ?? [])].filter((r) => r.timezone && r.from && r.from <= date).sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))
  return sorted.at(-1)?.timezone ?? fallback
}
